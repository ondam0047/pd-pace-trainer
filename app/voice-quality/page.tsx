"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  analyzeVoiceQuality,
  EMPTY_RESULT,
  MDVP_THRESHOLDS,
  getStatus,
  getHnrStatus,
  HNR_NORMAL,
  type VoiceQualityResult,
  type MdvpKey,
} from "@/components/voiceQuality/analyzer";
import SaveToHistory from "@/components/SaveToHistory";
import { decodeAudioFile } from "@/components/audioFile";

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

  const analyzeFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    setCurrentResult(EMPTY_RESULT);
    setPhase("analyzing");
    try {
      const { data, sampleRate } = await decodeAudioFile(file);
      const result = analyzeVoiceQuality(data, sampleRate);
      if (result.validFrames === 0) {
        setErrorMsg(
          "유효한 발성 구간을 찾지 못했습니다. 안정된 모음 발성이 담긴 파일을 사용하세요.",
        );
        setPhase("idle");
        return;
      }
      setCurrentResult(result);
      setTrials((prev) => [...prev, { timestamp: Date.now(), result }]);
      setPhase("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("오디오 파일을 분석할 수 없습니다. 다른 파일을 시도하세요.");
      setPhase("idle");
    }
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) analyzeFile(file);
    },
    [analyzeFile],
  );

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
          <h1 className="mt-2 text-3xl font-bold text-slate-900">음질 분석 (MDVP)</h1>
          <p className="mt-2 max-w-3xl text-slate-600">3초간 안정된 아— 발성을 녹음하거나 녹음 파일을 업로드하면 MDVP 정렬 파라미터(F0·Jitter·Shimmer·NHR 등)를 자동 산출하고 병리 임계값과 대조합니다.</p>
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
            <div className="space-y-3">
              <button onClick={start} className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700">3초 녹음 시작</button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-600 hover:border-blue-400 hover:bg-blue-50">
                📁 또는 오디오 파일 업로드 (지속 모음 발성)
                <input type="file" accept="audio/*" onChange={onFileChange} className="hidden" />
              </label>
            </div>
          )}
          {phase === "analyzing" && (
            <p className="text-center text-amber-700 animate-pulse">분석 중...</p>
          )}
          {phase === "done" && (
            <div className="flex flex-wrap gap-3">
              <button onClick={start} className="flex-1 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">다시 측정</button>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                📁 파일 업로드
                <input type="file" accept="audio/*" onChange={onFileChange} className="hidden" />
              </label>
              <button onClick={reset} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">전체 초기화</button>
            </div>
          )}
        </div>

        {hasResult && phase === "done" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  MDVP 음향 파라미터
                </h3>
                <span className="text-xs text-slate-500">
                  유효 {currentResult.validFrames} 프레임 ·{" "}
                  {currentResult.durationSec.toFixed(2)}초
                </span>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <MetricGroup title="기본주파수 (F0)">
                  <MetricRow label="F0 평균" code="F0" value={currentResult.f0Mean} unit="Hz" digits={1} />
                  <MetricRow label="최고 / 최저" code="Fhi/Flo" value={currentResult.f0Hi} unit="Hz" digits={1} extra={`${currentResult.f0Lo.toFixed(1)} Hz`} />
                  <MetricRow label="표준편차" code="STD" value={currentResult.f0SD} unit="Hz" digits={2} />
                  <MetricRow label="음역" code="PFR" value={currentResult.pfrSemitones} unit="st" digits={1} />
                  <MetricRow label="F0 변동" code="vF0" value={currentResult.vF0} unit="%" digits={2} mkey="vF0" />
                </MetricGroup>

                <MetricGroup title="주파수 변동 (Jitter)">
                  <MetricRow label="절대 지터" code="Jita" value={currentResult.jitaUs} unit="µs" digits={1} mkey="jitaUs" />
                  <MetricRow label="지터 %" code="Jitt" value={currentResult.jitterLocal} unit="%" digits={2} mkey="jitterLocal" />
                  <MetricRow label="상대평균섭동" code="RAP" value={currentResult.rap} unit="%" digits={2} mkey="rap" />
                  <MetricRow label="주기섭동지수" code="PPQ" value={currentResult.ppq5} unit="%" digits={2} mkey="ppq5" />
                </MetricGroup>

                <MetricGroup title="진폭 변동 (Shimmer)">
                  <MetricRow label="쉼머 %" code="Shim" value={currentResult.shimmerLocal} unit="%" digits={2} mkey="shimmerLocal" />
                  <MetricRow label="쉼머 dB" code="ShdB" value={currentResult.shdB} unit="dB" digits={2} mkey="shdB" />
                  <MetricRow label="진폭섭동지수" code="APQ" value={currentResult.apq11} unit="%" digits={2} mkey="apq11" />
                  <MetricRow label="진폭 변동" code="vAm" value={currentResult.vAm} unit="%" digits={2} mkey="vAm" />
                </MetricGroup>

                <MetricGroup title="잡음 (Noise)">
                  <MetricRow label="잡음대배음비" code="NHR" value={currentResult.nhr} unit="" digits={3} mkey="nhr" />
                  <MetricRow label="배음대잡음비" code="HNR" value={currentResult.hnr} unit="dB" digits={1} hnr />
                </MetricGroup>
              </div>
            </div>
            <SaveToHistory
              moduleId="voice_quality"
              summary={{
                "F0(Hz)": +currentResult.f0Mean.toFixed(1),
                "STD(Hz)": +currentResult.f0SD.toFixed(2),
                "Jita(us)": +currentResult.jitaUs.toFixed(1),
                "Jitt(%)": +currentResult.jitterLocal.toFixed(2),
                "RAP(%)": +currentResult.rap.toFixed(2),
                "PPQ(%)": +currentResult.ppq5.toFixed(2),
                "Shim(%)": +currentResult.shimmerLocal.toFixed(2),
                "ShdB(dB)": +currentResult.shdB.toFixed(2),
                "APQ(%)": +currentResult.apq11.toFixed(2),
                "vAm(%)": +currentResult.vAm.toFixed(2),
                "NHR": +currentResult.nhr.toFixed(3),
                "HNR(dB)": +currentResult.hnr.toFixed(1),
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
                    <th className="py-2 pr-3">Jitt</th>
                    <th className="py-2 pr-3">Shim</th>
                    <th className="py-2 pr-3">APQ</th>
                    <th className="py-2 pr-3">NHR</th>
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
                      <td className="py-2 pr-3">{t.result.apq11.toFixed(2)} %</td>
                      <td className="py-2 pr-3">{t.result.nhr.toFixed(3)}</td>
                      <td className="py-2">{t.result.hnr.toFixed(1)} dB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">MDVP 파라미터 · 정상 임계값 + 근거</summary>
          <div className="mt-3 space-y-3 text-sm">
            <table className="w-full text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1 pr-2">코드</th>
                  <th className="py-1 pr-2">의미</th>
                  <th className="py-1">정상 기준 (이하)</th>
                </tr>
              </thead>
              <tbody className="text-sm tabular-nums">
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">Jita</td><td className="pr-2">절대 지터</td><td>≤ {MDVP_THRESHOLDS.jitaUs} µs</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">Jitt</td><td className="pr-2">지터 %</td><td>≤ {MDVP_THRESHOLDS.jitterLocal} %</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">RAP</td><td className="pr-2">상대평균섭동</td><td>≤ {MDVP_THRESHOLDS.rap} %</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">PPQ</td><td className="pr-2">주기섭동지수(5점)</td><td>≤ {MDVP_THRESHOLDS.ppq5} %</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">vF0</td><td className="pr-2">F0 변동계수</td><td>≤ {MDVP_THRESHOLDS.vF0} %</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">Shim</td><td className="pr-2">쉼머 %</td><td>≤ {MDVP_THRESHOLDS.shimmerLocal} %</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">ShdB</td><td className="pr-2">쉼머 dB</td><td>≤ {MDVP_THRESHOLDS.shdB} dB</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">APQ</td><td className="pr-2">진폭섭동지수(11점)</td><td>≤ {MDVP_THRESHOLDS.apq11} %</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">vAm</td><td className="pr-2">진폭 변동계수</td><td>≤ {MDVP_THRESHOLDS.vAm} %</td></tr>
                <tr className="border-b border-slate-100"><td className="py-1 pr-2 font-mono">NHR</td><td className="pr-2">잡음대배음비</td><td>≤ {MDVP_THRESHOLDS.nhr}</td></tr>
                <tr><td className="py-1 pr-2 font-mono">HNR</td><td className="pr-2">배음대잡음비(보조)</td><td>≥ {HNR_NORMAL} dB</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-amber-700">
              ⚠ 프레임 단위 근사(주기 1개/프레임)로 산출하므로 KayPENTAX MDVP /
              Praat 본 프로그램과 수치 차이가 있을 수 있습니다. 임상 확정은
              MDVP/Praat 결과와 대조하세요. VTI·SPI·tremor·voice break 등 일부
              MDVP 항목은 미포함입니다.
            </p>
            <p className="text-xs text-slate-500">근거: KayPENTAX MDVP 병리 임계값 / Praat (Boersma &amp; Weenink) Voice 매뉴얼 / Chiarella 외 (2005) MDVP 정상규준</p>
          </div>
        </details>
      </div>
    </main>
  );
}

function MetricGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function MetricRow({
  label,
  code,
  value,
  unit,
  digits,
  extra,
  mkey,
  hnr,
}: {
  label: string;
  code: string;
  value: number;
  unit: string;
  digits: number;
  extra?: string;
  mkey?: MdvpKey;
  hnr?: boolean;
}) {
  const status = mkey
    ? getStatus(value, mkey)
    : hnr
      ? getHnrStatus(value)
      : null;
  const threshold = mkey
    ? `≤ ${MDVP_THRESHOLDS[mkey]}${unit ? " " + unit : ""}`
    : hnr
      ? `≥ ${HNR_NORMAL} dB`
      : "";
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-2">
        <span className="font-mono text-xs text-slate-500">{code}</span>{" "}
        <span className="text-slate-700">{label}</span>
      </td>
      <td className="py-1.5 pr-2 text-right font-semibold tabular-nums text-slate-900">
        {value.toFixed(digits)}
        {unit ? ` ${unit}` : ""}
        {extra ? ` / ${extra}` : ""}
      </td>
      <td className="py-1.5 text-right">
        {status ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              status === "normal"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-rose-100 text-rose-800"
            }`}
            title={threshold}
          >
            {status === "normal" ? "정상" : "이상"}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">참고</span>
        )}
      </td>
    </tr>
  );
}
