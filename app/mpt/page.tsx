"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SaveToHistory from "@/components/SaveToHistory";
import { decodeAudioFile } from "@/components/audioFile";

const VOICE_THRESHOLD = 0.008;
const END_SILENCE_MS = 500;
const MIN_PHONATION_SEC = 1.0;
const MAX_PHONATION_SEC = 60.0;
const MAX_TRIALS = 3;

// 디코드된 버퍼에서 최장 지속발성 구간(내부 묵음 < END_SILENCE_MS 허용) 길이 산출
function mptFromBuffer(data: Float32Array, sr: number): number {
  const win = Math.round(sr * 0.02); // 20ms 프레임
  if (win <= 0) return 0;
  const gapFrames = Math.ceil((END_SILENCE_MS / 1000) * sr / win);
  let best = 0;
  let runStart = -1;
  let lastVoiced = -1;
  let i = 0;
  for (let start = 0; start + win <= data.length; start += win, i++) {
    let sumSq = 0;
    for (let j = 0; j < win; j++) sumSq += data[start + j] * data[start + j];
    const rms = Math.sqrt(sumSq / win);
    if (rms > VOICE_THRESHOLD) {
      if (runStart < 0) runStart = i;
      lastVoiced = i;
    } else if (runStart >= 0 && i - lastVoiced > gapFrames) {
      best = Math.max(best, ((lastVoiced - runStart + 1) * win) / sr);
      runStart = -1;
    }
  }
  if (runStart >= 0) best = Math.max(best, ((lastVoiced - runStart + 1) * win) / sr);
  return Math.min(MAX_PHONATION_SEC, best);
}

type Trial = { duration: number; timestamp: number };
type Phase = "idle" | "waiting" | "phonating" | "done";

export default function MptPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentSec, setCurrentSec] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const phonationStartRef = useRef<number>(0);
  const lastVoicedRef = useRef<number>(0);

  const stopMic = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const a = analyserRef.current;
    if (!a) return;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const r = Math.sqrt(sum / buf.length);
    setCurrentLevel(r);
    const isVoiced = r > VOICE_THRESHOLD;
    const now = performance.now();

    if (phaseRef.current === "waiting") {
      if (isVoiced) {
        phonationStartRef.current = now;
        lastVoicedRef.current = now;
        phaseRef.current = "phonating";
        setPhase("phonating");
      }
    } else if (phaseRef.current === "phonating") {
      if (isVoiced) lastVoicedRef.current = now;
      const elapsed = (lastVoicedRef.current - phonationStartRef.current) / 1000;
      const silenceMs = now - lastVoicedRef.current;
      setCurrentSec(elapsed);
      if (silenceMs >= END_SILENCE_MS && elapsed >= MIN_PHONATION_SEC) {
        setTrials((prev) => [...prev, { duration: elapsed, timestamp: Date.now() }]);
        phaseRef.current = "done";
        setPhase("done");
        stopMic();
        return;
      }
      if (elapsed >= MAX_PHONATION_SEC) {
        setTrials((prev) => [...prev, { duration: elapsed, timestamp: Date.now() }]);
        phaseRef.current = "done";
        setPhase("done");
        stopMic();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [stopMic]);

  const start = useCallback(async () => {
    setErrorMsg(null);
    setCurrentSec(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0;
      analyserRef.current = a;
      src.connect(a);
      phonationStartRef.current = 0;
      lastVoicedRef.current = 0;
      phaseRef.current = "waiting";
      setPhase("waiting");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근 실패. 브라우저 권한을 확인해주세요.");
    }
  }, [tick]);

  const cancel = useCallback(() => {
    stopMic();
    phaseRef.current = "idle";
    setPhase("idle");
    setCurrentSec(0);
  }, [stopMic]);

  const analyzeFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    try {
      const { data, sampleRate } = await decodeAudioFile(file);
      const dur = mptFromBuffer(data, sampleRate);
      if (dur < MIN_PHONATION_SEC) {
        setErrorMsg(
          `발성 구간(≥${MIN_PHONATION_SEC}초)을 찾지 못했습니다. 지속 모음 발성이 담긴 파일을 사용하세요.`,
        );
        return;
      }
      setTrials((prev) => [...prev, { duration: dur, timestamp: Date.now() }]);
      setCurrentSec(dur);
      phaseRef.current = "done";
      setPhase("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("오디오 파일을 분석할 수 없습니다. 다른 파일을 시도하세요.");
    }
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file && trials.length < MAX_TRIALS) analyzeFile(file);
    },
    [analyzeFile, trials.length],
  );

  const removeTrial = useCallback((idx: number) => {
    setTrials((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const resetAll = useCallback(() => {
    stopMic();
    setTrials([]);
    setCurrentSec(0);
    phaseRef.current = "idle";
    setPhase("idle");
  }, [stopMic]);

  useEffect(() => () => stopMic(), [stopMic]);

  const mean = trials.length > 0 ? trials.reduce((a, b) => a + b.duration, 0) / trials.length : 0;
  const maxVal = trials.length > 0 ? Math.max(...trials.map((t) => t.duration)) : 0;
  const minVal = trials.length > 0 ? Math.min(...trials.map((t) => t.duration)) : 0;
  const sd = trials.length > 1
    ? Math.sqrt(trials.reduce((acc, t) => acc + (t.duration - mean) * (t.duration - mean), 0) / (trials.length - 1))
    : 0;
  const levelPercent = Math.min(100, (currentLevel / 0.1) * 100);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">🟢 호흡·발성 효율</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">MPT — 최대발성지속시간</h1>
          <p className="mt-2 max-w-3xl text-slate-600">깊이 숨을 들이마시고 “아—”를 최대한 길게 발성하세요. 발성을 멈추면 자동 종료되며 3회 측정해 평균값을 산출합니다. 미리 녹음한 파일을 업로드하면 최장 지속발성 구간을 자동 측정합니다.</p>
        </div>
        {errorMsg && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMsg}</div>}

        <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">측정 {Math.min(trials.length + 1, MAX_TRIALS)} / {MAX_TRIALS}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${phase === "idle" ? "bg-slate-100 text-slate-600" : phase === "waiting" ? "bg-amber-100 text-amber-800" : phase === "phonating" ? "bg-emerald-100 text-emerald-900" : "bg-blue-100 text-blue-800"}`}>
              {phase === "idle" && "대기"}
              {phase === "waiting" && "발성 대기"}
              {phase === "phonating" && "● 측정 중"}
              {phase === "done" && "완료"}
            </span>
          </div>

          <div className="my-10 text-center">
            <div className="text-8xl font-bold text-slate-900 tabular-nums">{currentSec.toFixed(1)}</div>
            <div className="mt-1 text-xl text-slate-500">초</div>
          </div>

          {(phase === "waiting" || phase === "phonating") && (
            <div className="mb-6">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>마이크 입력</span>
                <span>{(currentLevel * 1000).toFixed(0)}</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-slate-200">
                <div className={`absolute left-0 top-0 h-full transition-all ${currentLevel > VOICE_THRESHOLD ? "bg-emerald-500" : "bg-slate-400"}`} style={{ width: `${levelPercent}%` }} />
                <div className="absolute top-0 h-full w-px bg-amber-600" style={{ left: `${(VOICE_THRESHOLD / 0.1) * 100}%` }} title="발성 감지 임계값" />
              </div>
            </div>
          )}

          {phase === "idle" && (
            <div className="space-y-3">
              <button onClick={start} disabled={trials.length >= MAX_TRIALS} className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {trials.length === 0 ? "측정 시작" : trials.length >= MAX_TRIALS ? "3회 측정 완료" : `${trials.length + 1}회 측정 시작`}
              </button>
              {trials.length < MAX_TRIALS && (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-600 hover:border-emerald-400 hover:bg-emerald-50">
                  📁 또는 발성 녹음 파일 업로드 (최장 지속발성 자동 측정)
                  <input type="file" accept="audio/*" onChange={onFileChange} className="hidden" />
                </label>
              )}
            </div>
          )}
          {phase === "waiting" && (
            <div className="space-y-3">
              <p className="text-center text-sm font-medium text-amber-700">&quot;아—&quot; 발성을 시작하세요 (자동 감지)</p>
              <button onClick={cancel} className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">취소</button>
            </div>
          )}
          {phase === "phonating" && (
            <div className="space-y-3">
              <p className="animate-pulse text-center text-sm font-medium text-emerald-700">● 측정 중 — 계속 발성하세요</p>
              <button onClick={cancel} className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">취소</button>
            </div>
          )}
          {phase === "done" && (
            <div className="space-y-3">
              <p className="text-center text-sm font-medium text-blue-700">✓ 이번 회기: {currentSec.toFixed(2)}초</p>
              {trials.length < MAX_TRIALS && (
                <button onClick={start} className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white hover:bg-emerald-700">다음 측정 ({trials.length + 1}/{MAX_TRIALS})</button>
              )}
              {trials.length < MAX_TRIALS && (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  📁 파일 업로드로 다음 측정
                  <input type="file" accept="audio/*" onChange={onFileChange} className="hidden" />
                </label>
              )}
              {trials.length >= MAX_TRIALS && (
                <button onClick={() => { phaseRef.current = "idle"; setPhase("idle"); }} className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">결과 확인</button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">시도 기록</h2>
            {trials.length > 0 && <button onClick={resetAll} className="text-xs text-slate-500 hover:text-rose-600">전체 초기화</button>}
          </div>
          {trials.length === 0 ? (
            <p className="text-sm text-slate-500">아직 측정된 기록이 없습니다.</p>
          ) : (
            <>
              <div className="space-y-2">
                {trials.map((t, i) => (
                  <div key={t.timestamp} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-baseline gap-3">
                      <span className="font-semibold text-slate-700">{i + 1}회차</span>
                      <span className="text-xl font-bold tabular-nums text-emerald-700">{t.duration.toFixed(2)} 초</span>
                    </div>
                    <button onClick={() => removeTrial(i)} className="text-xs text-slate-400 hover:text-rose-600">제거</button>
                  </div>
                ))}
              </div>
              {trials.length >= MAX_TRIALS && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-emerald-900">종합 결과</h3>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Stat label="평균" value={`${mean.toFixed(2)} 초`} highlight />
                      <Stat label="최대" value={`${maxVal.toFixed(2)} 초`} />
                      <Stat label="최소" value={`${minVal.toFixed(2)} 초`} />
                      <Stat label="표준편차" value={`${sd.toFixed(2)} 초`} />
                    </div>
                  </div>
                  <SaveToHistory
                    moduleId="mpt"
                    summary={{
                      "평균(초)": +mean.toFixed(2),
                      "최대(초)": +maxVal.toFixed(2),
                      "최소(초)": +minVal.toFixed(2),
                      "SD(초)": +sd.toFixed(2),
                      "시행수": trials.length,
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">참고 정상 범위 + 근거</summary>
          <div className="mt-3 space-y-2 text-sm">
            <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-slate-700">
              <div>아동 7세 남자</div><div className="font-semibold tabular-nums">9 – 16 초</div>
              <div>아동 7세 여자</div><div className="font-semibold tabular-nums">8 – 14 초</div>
              <div>성인 남자</div><div className="font-semibold tabular-nums">25 – 35 초</div>
              <div>성인 여자</div><div className="font-semibold tabular-nums">15 – 25 초</div>
            </div>
            <p className="mt-3 text-xs text-slate-500">근거: 보은아 외 (2023) 『음성 평가』 / Hirano (1981) Clinical Examination of Voice</p>
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">측정 방법 안내</summary>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <ol className="list-decimal space-y-1 pl-5">
              <li>편안한 자세로 앜으며 등을 곱게 세웁니다</li>
              <li>&quot;측정 시작&quot; 버튼을 누릅니다</li>
              <li>깊게 숨을 들이마시고 &quot;아—&quot;를 최대한 길게 발성합니다</li>
              <li>발성이 멈추면 0.5초 후 자동 종료됩니다</li>
              <li>3회 반복합니다 (각 회기 사이 30초 이상 휴식 권장)</li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">⚠ 주변 소음이 큰 환경에서는 자동 감지 정확도가 떨어질 수 있습니다. 조용한 방에서 측정하세요.</p>
          </div>
        </details>
      </div>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white px-3 py-2 ${highlight ? "border-emerald-400" : "border-emerald-200"}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "text-emerald-900" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
