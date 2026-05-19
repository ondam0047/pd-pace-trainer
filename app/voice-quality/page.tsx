"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  analyzeVoiceQuality,
  EMPTY_RESULT,
  NORMAL_RANGES,
  getStatus,
  type VoiceQualityResult,
} from "@/components/voiceQuality/analyzer";
import SaveToHistory from "@/components/SaveToHistory";

const RECORD_DURATION_SEC = 3;

type Trial = { timestamp: number; result: VoiceQualityResult };
type Phase = "idle" | "recording" | "analyzing" | "done";

export default function VoiceQualityPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [currentResult, setCurrentResult] = useState<VoiceQualityResult>(EMPTY_RESULT);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedRef = useRef<Float32Array[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => undefined); audioCtxRef.current = null; }
  }, []);

  const start = useCallback(async () => {
    setErrorMsg(null);
    setProgress(0);
    setCurrentResult(EMPTY_RESULT);
    setPhase("recording");
    recordedRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        recordedRef.current.push(copy);
      };
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(ctx.destination);

      startTimeRef.current = performance.now();

      const tick = () => {
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        const pct = Math.min(100, (elapsed / RECORD_DURATION_SEC) * 100);
        setProgress(pct);

        if (elapsed >= RECORD_DURATION_SEC) {
          // 녹음 종료, 분석 시작
          if (processorRef.current) processorRef.current.disconnect();
          if (sourceRef.current) sourceRef.current.disconnect();
          setPhase("analyzing");

          const totalLen = recordedRef.current.reduce((s, b) => s + b.length, 0);
          const combined = new Float32Array(totalLen);
          let offset = 0;
          for (const b of recordedRef.current) {
            combined.set(b, offset);
            offset += b.length;
          }
          const sr = audioCtxRef.current?.sampleRate ?? 44100;

          setTimeout(() => {
            const result = analyzeVoiceQuality(combined, sr);
            setCurrentResult(result);
            setTrials(prev => [...prev, { timestamp: Date.now(), result }]);
            setPhase("done");
            cleanup();
          }, 50);
        } else {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근 실패");
      setPhase("idle");
      cleanup();
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    setTrials([]);
    setCurrentResult(EMPTY_RESULT);
    setPhase("idle");
    setProgress(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const hasResult = currentResult.validFrames > 0;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">🔵 음향 분석</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">음질 분석</h1>
          <p className="mt-2 max-w-3xl text-slate-600">3초간 안정된 아— 발성을 녹음하면 jitter, shimmer, HNR을 자동 산출합니다.</p>
          <p className="mt-1 max-w-3xl text-xs text-amber-700">⚠ 브라우저 계산이므로 Praat보다 정확도가 낮을 수 있습니다. 임상 획립은 Praat 결과와 대조하세요.</p>
        </div>
        {errorMsg && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMsg}</div>}

        <div className="rounded-2xl border border-blue-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">녹음 측정</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${phase === "idle" ? "bg-slate-100 text-slate-600" : phase === "recording" ? "bg-blue-100 text-blue-900" : phase === "analyzing" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
              {phase === "idle" && "대기"}
              {phase === "recording" && "● 녹음 중"}
              {phase === "analyzing" && "⚡ 분석 중"}
              {phase === "done" && "✓ 완료"}
            </span>
          </div>

          <p className="mb-4 text-sm text-slate-600">깊어 숨을 들이마시고 &quot;아—&quot;를 3초간 일정한 크기·높이로 발성하세요.</p>

          {phase === "recording" && (
            <div className="mb-6">
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-center text-sm text-blue-700">{progress.toFixed(0)}%</p>
            </div>
          )}

          {phase === "idle" && (
            <button onClick={start} className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700">3초 녹음 시작</button>
          )}
          {phase === "analyzing" && (
            <p className="text-center text-amber-700 animate-pulse">분석 중...</p>
          )}
          {phase === "done" && (
            <div className="flex gap-3">
              <button onClick={start} className="flex-1 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">다시 측정</button>
              <button onClick={reset} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">전체 초기화</button>
            </div>
          )}
        </div>

        {hasResult && phase === "done" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">최근 결과</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ResultBox label="F0 평균" value={`${currentResult.f0Mean.toFixed(1)} Hz`} sub={`SD ${currentResult.f0SD.toFixed(1)}`} />
                <ResultBox label="유효 프레임" value={`${currentResult.validFrames}`} sub={`${currentResult.durationSec.toFixed(2)}초`} />
                <ResultBox label="HNR" value={`${currentResult.hnr.toFixed(1)} dB`} status={getStatus(currentResult.hnr, "hnr")} />
                <ResultBox label="jitter (local)" value={`${currentResult.jitterLocal.toFixed(2)} %`} status={getStatus(currentResult.jitterLocal, "jitterLocal")} />
                <ResultBox label="jitter (RAP)" value={`${currentResult.jitterRap.toFixed(2)} %`} status={getStatus(currentResult.jitterRap, "jitterRap")} />
                <ResultBox label="shimmer (local)" value={`${currentResult.shimmerLocal.toFixed(2)} %`} status={getStatus(currentResult.shimmerLocal, "shimmerLocal")} />
                <ResultBox label="shimmer (APQ3)" value={`${currentResult.shimmerApq3.toFixed(2)} %`} status={getStatus(currentResult.shimmerApq3, "shimmerApq3")} />
              </div>
            </div>
            <SaveToHistory
              moduleId="voice_quality"
              summary={{
                "F0(Hz)": +currentResult.f0Mean.toFixed(1),
                "F0_SD": +currentResult.f0SD.toFixed(1),
                "HNR(dB)": +currentResult.hnr.toFixed(1),
                "jitter_local(%)": +currentResult.jitterLocal.toFixed(2),
                "jitter_RAP(%)": +currentResult.jitterRap.toFixed(2),
                "shimmer_local(%)": +currentResult.shimmerLocal.toFixed(2),
                "shimmer_APQ3(%)": +currentResult.shimmerApq3.toFixed(2),
              }}
            />
          </div>
        )}

        {trials.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-900">측정 기록 ({trials.length}회)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">F0</th>
                    <th className="py-2 pr-3">jitter</th>
                    <th className="py-2 pr-3">shimmer</th>
                    <th className="py-2">HNR</th>
                  </tr>
                </thead>
                <tbody>
                  {trials.map((t, i) => (
                    <tr key={t.timestamp} className="border-b border-slate-100 tabular-nums text-slate-700">
                      <td className="py-2 pr-3 font-semibold">{i + 1}</td>
                      <td className="py-2 pr-3">{t.result.f0Mean.toFixed(1)} Hz</td>
                      <td className="py-2 pr-3">{t.result.jitterLocal.toFixed(2)} %</td>
                      <td className="py-2 pr-3">{t.result.shimmerLocal.toFixed(2)} %</td>
                      <td className="py-2">{t.result.hnr.toFixed(1)} dB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">정상 범위 + 근거</summary>
          <div className="mt-3 space-y-2 text-sm">
            <table className="w-full text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1">지표</th>
                  <th className="py-1">정상</th>
                  <th className="py-1">이상</th>
                </tr>
              </thead>
              <tbody className="text-sm tabular-nums">
                <tr className="border-b border-slate-100"><td className="py-1">jitter (local)</td><td>≤ {NORMAL_RANGES.jitterLocal.normal}%</td><td>≥ {NORMAL_RANGES.jitterLocal.abnormal}%</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1">jitter (RAP)</td><td>≤ {NORMAL_RANGES.jitterRap.normal}%</td><td>≥ {NORMAL_RANGES.jitterRap.abnormal}%</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1">shimmer (local)</td><td>≤ {NORMAL_RANGES.shimmerLocal.normal}%</td><td>≥ {NORMAL_RANGES.shimmerLocal.abnormal}%</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1">shimmer (APQ3)</td><td>≤ {NORMAL_RANGES.shimmerApq3.normal}%</td><td>≥ {NORMAL_RANGES.shimmerApq3.abnormal}%</td></tr>
                <tr><td className="py-1">HNR</td><td>≥ {NORMAL_RANGES.hnr.normal} dB</td><td>≤ {NORMAL_RANGES.hnr.abnormal} dB</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">근거: Praat (Boersma & Weenink) 기본 임계치 / Teixeira & Lopes (2017) Voice acoustic analysis</p>
          </div>
        </details>
      </div>
    </main>
  );
}

function ResultBox({ label, value, sub, status }: { label: string; value: string; sub?: string; status?: "normal" | "borderline" | "abnormal" }) {
  const statusColors: Record<string, string> = {
    normal: "border-emerald-300 bg-emerald-50",
    borderline: "border-amber-300 bg-amber-50",
    abnormal: "border-rose-300 bg-rose-50",
  };
  const statusText: Record<string, string> = {
    normal: "정상",
    borderline: "경계",
    abnormal: "이상",
  };
  const statusLabelColor: Record<string, string> = {
    normal: "text-emerald-800",
    borderline: "text-amber-800",
    abnormal: "text-rose-800",
  };
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 ${status ? statusColors[status] : "border-slate-200"}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
        {status && <span className={`text-[10px] font-bold ${statusLabelColor[status]}`}>{statusText[status]}</span>}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
