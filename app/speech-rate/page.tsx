"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  analyzeSpeechRate,
  type SpeechRateResult,
} from "@/components/speechRate/analyzer";
import { useKoreanASR } from "@/components/asr/useKoreanASR";
import {
  countSyllables,
  normalizeTranscript,
} from "@/components/asr/syllableCount";
import SaveToHistory from "@/components/SaveToHistory";
import { decodeAudioFile } from "@/components/audioFile";

type Phase = "idle" | "recording" | "done";
const DURATION_OPTIONS = [10, 15, 30, 60] as const;
type Duration = (typeof DURATION_OPTIONS)[number];

export default function SpeechRatePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [maxDuration, setMaxDuration] = useState<Duration>(15);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SpeechRateResult | null>(null);
  const [syllables, setSyllables] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [autoFilled, setAutoFilled] = useState(false);

  const asr = useKoreanASR();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedRef = useRef<Float32Array[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const finalizeAndAnalyze = useCallback(() => {
    if (processorRef.current) processorRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();

    const totalLen = recordedRef.current.reduce((s, b) => s + b.length, 0);
    const combined = new Float32Array(totalLen);
    let offset = 0;
    for (const b of recordedRef.current) {
      combined.set(b, offset);
      offset += b.length;
    }
    const sr = audioCtxRef.current?.sampleRate ?? 44100;
    const res = analyzeSpeechRate(combined, sr);
    setResult(res);
    setPhase("done");
    asr.stop();
    cleanup();
  }, [cleanup, asr]);

  const start = useCallback(async () => {
    setErrorMsg(null);
    setElapsed(0);
    setResult(null);
    setEditedTranscript("");
    setAutoFilled(false);
    setSyllables("");
    setPhase("recording");
    recordedRef.current = [];
    if (asr.supported) asr.start();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        recordedRef.current.push(copy);
      };
      processorRef.current = proc;
      source.connect(proc);
      proc.connect(ctx.destination);
      startTimeRef.current = performance.now();

      const tick = () => {
        const e = (performance.now() - startTimeRef.current) / 1000;
        setElapsed(e);
        if (e >= maxDuration) {
          finalizeAndAnalyze();
        } else {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근 실패");
      setPhase("idle");
      asr.stop();
      cleanup();
    }
  }, [maxDuration, finalizeAndAnalyze, cleanup, asr]);

  const analyzeFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      setResult(null);
      setEditedTranscript("");
      setSyllables("");
      setAutoFilled(true); // 파일 업로드 시 ASR 자동채움 비활성 (전사 직접 입력)
      try {
        const { data, sampleRate } = await decodeAudioFile(file);
        const res = analyzeSpeechRate(data, sampleRate);
        setResult(res);
        setPhase("done");
      } catch (err) {
        console.error(err);
        setErrorMsg("오디오 파일을 분석할 수 없습니다. 다른 파일을 시도하세요.");
        setPhase("idle");
      }
    },
    [],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) analyzeFile(file);
    },
    [analyzeFile],
  );

  const stopEarly = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    finalizeAndAnalyze();
  }, [finalizeAndAnalyze]);

  const reset = useCallback(() => {
    setResult(null);
    setSyllables("");
    setEditedTranscript("");
    setAutoFilled(false);
    setPhase("idle");
    setElapsed(0);
    asr.reset();
  }, [asr]);

  // 녹음이 끝났을 때 ASR 전사로부터 음절 수 자동 산출.
  useEffect(() => {
    if (phase !== "done") return;
    if (!asr.supported) return;
    const finalText = normalizeTranscript(asr.finalTranscript);
    if (autoFilled || !finalText) return;
    setEditedTranscript(finalText);
    setSyllables(String(countSyllables(finalText)));
    setAutoFilled(true);
  }, [phase, asr.finalTranscript, asr.supported, autoFilled]);

  const recountFromEdited = useCallback(() => {
    setSyllables(String(countSyllables(editedTranscript)));
  }, [editedTranscript]);

  useEffect(() => () => cleanup(), [cleanup]);

  const syllablesNum = parseInt(syllables, 10);
  const validSyllables = !isNaN(syllablesNum) && syllablesNum > 0;

  const overallSPS =
    result && validSyllables
      ? syllablesNum / result.totalDuration
      : 0;
  const articulationSPS =
    result && validSyllables && result.speechDuration > 0
      ? syllablesNum / result.speechDuration
      : 0;
  const overallWPM = overallSPS * 60 / 2.5; // 음절·단어 대략 2.5음절 기준

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Voice Lab 허브로
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            🟡 말 흐름
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            말속도 분석
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            녹음 한 번 또는 녹음 파일 업로드로 전체속도 + 조음속도 + 쉬 구간
            분석을 동시 제공합니다. VAD 로 쉬를 자동 분할하고, 실시간 녹음 시
            음성 인식으로 음절 수까지 자동 산출합니다 (파일 업로드는 전사
            붙여넣기/직접 입력).
          </p>
        </div>
        {errorMsg && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">녹음</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                phase === "idle"
                  ? "bg-slate-100 text-slate-600"
                  : phase === "recording"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {phase === "idle" && "대기"}
              {phase === "recording" && "● 녹음 중"}
              {phase === "done" && "✓ 완료"}
            </span>
          </div>

          {phase === "idle" && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  최대 녹음 시간
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-300">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setMaxDuration(d)}
                      className={`flex-1 px-3 py-2 text-sm font-medium ${
                        d === maxDuration
                          ? "bg-amber-600 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {d}초
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={start}
                className="w-full rounded-xl bg-amber-600 px-6 py-4 text-lg font-semibold text-white hover:bg-amber-700"
              >
                녹음 시작
              </button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-600 hover:border-amber-400 hover:bg-amber-50">
                📁 또는 녹음 파일 업로드
                <input type="file" accept="audio/*" onChange={onFileChange} className="hidden" />
              </label>
              <p className="text-xs text-slate-500">
                &quot;녹음 시작&quot; 후 대상자에게 낭독·자유발화를 요청하세요
                (설정 시간에 자동 종료, 조기 종료 가능). 또는 미리 녹음한 파일을
                업로드하면 VAD 로 쉬를 자동 분할합니다. 파일 업로드 시 음절 수는
                전사를 붙여넣거나 직접 입력하세요.
              </p>
            </div>
          )}

          {phase === "recording" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-6xl font-bold tabular-nums text-slate-900">
                  {elapsed.toFixed(1)}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  / {maxDuration}초
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${(elapsed / maxDuration) * 100}%` }}
                />
              </div>
              {asr.supported && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-1 text-xs font-medium text-amber-900">
                    실시간 전사 {asr.active ? "● 인식 중" : "대기"}
                  </p>
                  <p className="min-h-[1.5rem] text-sm text-slate-800">
                    <span>{asr.finalTranscript}</span>
                    <span className="text-slate-400"> {asr.interim}</span>
                  </p>
                </div>
              )}
              <button
                onClick={stopEarly}
                className="w-full rounded-xl bg-slate-700 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                조기 종료 + 분석
              </button>
            </div>
          )}

          {phase === "done" && result && (
            <div className="space-y-4">
              <p className="text-sm text-emerald-700">
                ✓ 녹음 완료 · 자동 분석 결과
              </p>

              {/* Segment visualization */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  발화 / 쉬 구간 (녹색 = 발화, 회색 = 쉬)
                </p>
                <SegmentTimeline result={result} />
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded bg-emerald-500"></span>{" "}
                    발화 {result.speechDuration.toFixed(2)}초
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded bg-slate-400"></span>{" "}
                    쉬 {result.pauseDuration.toFixed(2)}초 ({result.pauseCount}회)
                  </span>
                </div>
              </div>

              {asr.supported ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      자동 전사 (수정 가능)
                    </label>
                    <textarea
                      value={editedTranscript}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      rows={3}
                      placeholder={
                        asr.finalTranscript
                          ? ""
                          : "전사 결과 없음 — 직접 입력하거나 음절 수만 아래에 입력하세요."
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Web Speech API (Chrome/Edge) · 한국어 인식
                      </span>
                      <button
                        onClick={recountFromEdited}
                        className="rounded border border-amber-300 bg-white px-2 py-1 font-medium text-amber-800 hover:bg-amber-50"
                      >
                        전사 → 음절 수 재계산
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      음절 수 (자동 카운트, 수정 가능)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={syllables}
                      onChange={(e) => setSyllables(e.target.value)}
                      placeholder="예: 45"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-semibold tabular-nums focus:border-amber-500 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      한글 음절 블록·자모·숫자 자릿수·영어 단어(모음군) 합산.
                      ASR 인식 오류 가능 → 임상가 검토 후 보정 권장.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    음절 수 입력 (대상자가 말한 전체 음절 수)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={syllables}
                    onChange={(e) => setSyllables(e.target.value)}
                    placeholder="예: 45"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-semibold tabular-nums focus:border-amber-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-amber-700">
                    이 브라우저는 음성 인식을 지원하지 않습니다. Chrome/Edge
                    사용을 권장합니다. 직접 음절 수를 입력하세요.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={start}
                  className="flex-1 rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  다시 녹음
                </button>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  📁 파일 업로드
                  <input type="file" accept="audio/*" onChange={onFileChange} className="hidden" />
                </label>
                <button
                  onClick={reset}
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  전체 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {phase === "done" && result && (
          <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-slate-900">분석 결과</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultBox label="전체 시간" value={`${result.totalDuration.toFixed(2)} 초`} />
              <ResultBox label="순 발화 시간" value={`${result.speechDuration.toFixed(2)} 초`} sub={`${((result.speechDuration / result.totalDuration) * 100).toFixed(0)}% of total`} />
              <ResultBox label="쉬 구간 수" value={`${result.pauseCount} 회`} sub={`장쉬(≥250ms) ${result.longPauseCount}회`} />
              <ResultBox label="평균 쉬 길이" value={`${(result.meanPauseDuration * 1000).toFixed(0)} ms`} sub={`최대 ${(result.maxPauseDuration * 1000).toFixed(0)} ms`} />
            </div>
            {validSyllables && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-amber-900">
                    음절 수 {syllablesNum}개 기준 말속도
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ResultBox label="전체 말속도" value={`${overallSPS.toFixed(2)} SPS`} sub={`≈ ${overallWPM.toFixed(0)} WPM`} highlight />
                    <ResultBox label="조음속도" value={`${articulationSPS.toFixed(2)} SPS`} sub={"쉬 제외"} />
                    <ResultBox label="속도 비율" value={`${(overallSPS / articulationSPS * 100 || 0).toFixed(0)}%`} sub={"전체/조음"} />
                  </div>
                </div>
                <SaveToHistory
                  moduleId="speech_rate"
                  summary={{
                    "음절수": syllablesNum,
                    "전체속도(SPS)": +overallSPS.toFixed(2),
                    "조음속도(SPS)": +articulationSPS.toFixed(2),
                    "전체시간(s)": +result.totalDuration.toFixed(2),
                    "발화시간(s)": +result.speechDuration.toFixed(2),
                    "쉼횟수": result.pauseCount,
                    "장쉼횟수": result.longPauseCount,
                    "평균쉼(ms)": +(result.meanPauseDuration * 1000).toFixed(0),
                  }}
                />
              </div>
            )}
          </div>
        )}

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            참고 정상 범위 + 근거
          </summary>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-semibold">성인 정상 명료</p>
              <p className="text-xs text-slate-600">
                낭독: 4.5–6.0 SPS / 자유발화: 3.5–5.0 SPS
              </p>
            </div>
            <div>
              <p className="font-semibold">파킨슨병</p>
              <p className="text-xs text-slate-600">
                조음속도 정상 수준 유지 → 전체속도는 올라갈 수 있음
                (쉬가 적음)
              </p>
            </div>
            <div>
              <p className="font-semibold">상안 말더듬</p>
              <p className="text-xs text-slate-600">
                조음속도·전체속도 감소, 장쉬 빈도 증가
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              근거: 신문자 (2008), Tjaden & Wilding (2004), Yorkston 외
              (2010), 공경희 외 (2018)
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}

function SegmentTimeline({ result }: { result: SpeechRateResult }) {
  const total = result.totalDuration;
  if (total <= 0) return null;
  const startBase = result.segments[0]?.start ?? 0;
  return (
    <div className="flex h-8 overflow-hidden rounded border border-slate-300">
      {result.segments.map((s, i) => {
        const width = ((s.end - s.start) / total) * 100;
        return (
          <div
            key={i}
            className={s.type === "speech" ? "bg-emerald-500" : "bg-slate-400"}
            style={{ width: `${width}%` }}
            title={`${s.type === "speech" ? "발화" : "쉬"}: ${(s.end - s.start).toFixed(2)}초`}
          />
        );
      })}
    </div>
  );
}

function ResultBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 ${highlight ? "border-amber-400" : "border-slate-200"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${highlight ? "text-amber-900" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
