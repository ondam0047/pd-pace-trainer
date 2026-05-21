"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useKoreanASR } from "@/components/asr/useKoreanASR";
import {
  countSyllables,
  normalizeTranscript,
} from "@/components/asr/syllableCount";
import SaveToHistory from "@/components/SaveToHistory";
import {
  detectDisfluencies,
  KIND_LABEL,
  KIND_TO_TAG,
  type DetectedDisfluency,
} from "@/components/fluency/disfluencyDetector";
import WaveformTimeline, {
  type TimelineMarker,
} from "@/components/fluency/WaveformTimeline";

// P-FA-II (파라다이스-유창성 검사 II) 비유창성 유형
//  - ND (정상적 비유창): 주저(H)·간투사(I)·미완성/수정(UR)·반복1(R1)
//  - AD (비정상적 비유창): 반복2(R2)·비운율적 발성(DP)
//  - ND 유형도 질적 양상(긴장·탈출행동) 동반 시 AD 로 산정 (hasTension)
type DisfluencyType = "H" | "I" | "UR" | "R1" | "R2" | "DP";

const TYPES: {
  id: DisfluencyType;
  code: string;
  label: string;
  key: string;
  baseCategory: "ND" | "AD";
  description: string;
  color: string; // Tailwind bg
  hex: string; // 타임라인 마커 색
}[] = [
  { id: "H", code: "H", label: "주저", key: "1", baseCategory: "ND", description: "1~3초 정도 머뭇거림 (예: … 그게)", color: "bg-sky-500 hover:bg-sky-600", hex: "#0ea5e9" },
  { id: "I", code: "I", label: "간투사", key: "2", baseCategory: "ND", description: "의미 없는 삽입어 (예: 음·어·그)", color: "bg-cyan-500 hover:bg-cyan-600", hex: "#06b6d4" },
  { id: "UR", code: "U/Ur", label: "미완성·수정", key: "3", baseCategory: "ND", description: "발화 미완성 또는 수정 (예: 난 아니 제가)", color: "bg-blue-500 hover:bg-blue-600", hex: "#3b82f6" },
  { id: "R1", code: "R1", label: "반복1", key: "4", baseCategory: "ND", description: "다음절 낱말·구·어절 반복 (예: 어제-어제)", color: "bg-teal-500 hover:bg-teal-600", hex: "#14b8a6" },
  { id: "R2", code: "R2", label: "반복2", key: "5", baseCategory: "AD", description: "음절·낱말부분·일음절 낱말 반복 (예: 지-지-지구)", color: "bg-rose-500 hover:bg-rose-600", hex: "#f43f5e" },
  { id: "DP", code: "DP", label: "비운율적 발성", key: "6", baseCategory: "AD", description: "연장·막힘·깨진 낱말 (예: 나—는, 막힘)", color: "bg-red-700 hover:bg-red-800", hex: "#b91c1c" },
];

function classifyTag(type: DisfluencyType, hasTension: boolean): "ND" | "AD" {
  const def = TYPES.find((t) => t.id === type);
  if (!def) return "ND";
  if (def.baseCategory === "AD") return "AD";
  return hasTension ? "AD" : "ND";
}

type Tag = {
  id: number;
  time: number;
  type: DisfluencyType;
  hasTension: boolean;
};

type Stage = "input" | "analyzing" | "review";

function computePeaks(data: Float32Array, buckets: number): number[] {
  const out = new Array(buckets).fill(0);
  const size = Math.floor(data.length / buckets) || 1;
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const start = i * size;
    const end = Math.min(data.length, start + size);
    for (let j = start; j < end; j++) {
      const a = Math.abs(data[j]);
      if (a > max) max = a;
    }
    out[i] = max;
  }
  const peak = Math.max(...out, 1e-6);
  return out.map((v) => v / peak);
}

export default function FluencyPage() {
  const [stage, setStage] = useState<Stage>("input");
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [detected, setDetected] = useState<DetectedDisfluency[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [tensionMode, setTensionMode] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [syllables, setSyllables] = useState("");

  const asr = useKoreanASR();
  const tagIdRef = useRef(1);

  // 녹음
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const recStartRef = useRef(0);

  // 재생
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const tensionRef = useRef(false);
  const stageRef = useRef<Stage>("input");

  useEffect(() => {
    tensionRef.current = tensionMode;
  }, [tensionMode]);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // 오디오 Blob (녹음/업로드 공통) → 디코드 + 파형 + 탐지
  const handleAudioBlob = useCallback(async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setStage("analyzing");
    try {
      const arrayBuf = await blob.arrayBuffer();
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const data = audioBuf.getChannelData(0);
      const sr = audioBuf.sampleRate;
      await ctx.close();

      setPeaks(computePeaks(data, 1400));
      setDuration(audioBuf.duration);
      setCurrentTime(0);

      // 무거운 탐지는 다음 틱으로
      setTimeout(() => {
        try {
          setDetected(detectDisfluencies(data, sr));
        } catch (err) {
          console.error("비유창 탐지 실패", err);
          setDetected([]);
        }
        setStage("review");
      }, 30);
    } catch (err) {
      console.error("오디오 디코딩 실패", err);
      setMicError("오디오를 디코딩할 수 없습니다. 다른 파일을 시도하세요.");
      setStage("input");
    }
  }, []);

  // 녹음 시작/종료
  const startRecording = useCallback(async () => {
    setMicError(null);
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      recStreamRef.current = stream;
      recChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recChunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        handleAudioBlob(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecElapsed(0);
      recStartRef.current = performance.now();
      recTimerRef.current = window.setInterval(() => {
        setRecElapsed((performance.now() - recStartRef.current) / 1000);
      }, 100);
      if (asr.supported) asr.start();
    } catch (err) {
      console.error(err);
      setMicError(
        "마이크 접근 실패 — 오디오 파일 업로드를 사용하세요.",
      );
    }
  }, [asr, handleAudioBlob]);

  const stopRecording = useCallback(() => {
    if (recTimerRef.current !== null) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecording(false);
    asr.stop();
    mediaRecorderRef.current?.stop();
  }, [asr]);

  // 녹음 종료 후 ASR 전사 → 자동 채움
  useEffect(() => {
    if (stage !== "review") return;
    if (!asr.supported) return;
    const finalText = normalizeTranscript(asr.finalTranscript);
    if (!finalText) return;
    setTranscript((prev) => prev || finalText);
    setSyllables((prev) => prev || String(countSyllables(finalText)));
  }, [stage, asr.finalTranscript, asr.supported]);

  // 파일 업로드
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMicError(null);
    handleAudioBlob(file);
  };

  // 재생 헤드 갱신 (rAF)
  useEffect(() => {
    const tick = () => {
      const a = audioRef.current;
      if (a) setCurrentTime(a.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (a) {
      a.currentTime = t;
      setCurrentTime(t);
    }
  }, []);

  const addTagAt = useCallback((type: DisfluencyType, time: number) => {
    setTags((prev) =>
      [
        ...prev,
        { id: tagIdRef.current++, time, type, hasTension: tensionRef.current },
      ].sort((a, b) => a.time - b.time),
    );
  }, []);

  // 키보드: 1-6 태그(현재 위치), 0/T 긴장, space 재생/정지
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (stageRef.current !== "review") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key === "0" || e.key === "t" || e.key === "T") {
        e.preventDefault();
        setTensionMode((v) => !v);
        return;
      }
      const t = TYPES.find((tt) => tt.key === e.key);
      if (t) {
        e.preventDefault();
        addTagAt(t.id, audioRef.current?.currentTime ?? 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addTagAt, togglePlay]);

  const removeTag = (id: number) =>
    setTags((prev) => prev.filter((t) => t.id !== id));
  const toggleTagTension = (id: number) =>
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hasTension: !t.hasTension } : t)),
    );

  const acceptDetection = (idx: number) => {
    const ev = detected[idx];
    if (!ev) return;
    const type = KIND_TO_TAG[ev.kind] as DisfluencyType;
    setTags((prev) =>
      [
        ...prev,
        { id: tagIdRef.current++, time: ev.start, type, hasTension: false },
      ].sort((a, b) => a.time - b.time),
    );
    setAccepted((prev) => new Set(prev).add(idx));
  };
  const dismissDetection = (idx: number) =>
    setDismissed((prev) => new Set(prev).add(idx));
  const acceptAllDetections = () =>
    detected.forEach((_, idx) => {
      if (!accepted.has(idx) && !dismissed.has(idx)) acceptDetection(idx);
    });

  const reset = () => {
    if (recTimerRef.current !== null) clearInterval(recTimerRef.current);
    if (recStreamRef.current)
      recStreamRef.current.getTracks().forEach((t) => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setStage("input");
    setRecording(false);
    setRecElapsed(0);
    setAudioUrl(null);
    setPeaks([]);
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    setTags([]);
    setDetected([]);
    setDismissed(new Set());
    setAccepted(new Set());
    setTensionMode(false);
    setTranscript("");
    setSyllables("");
    setMicError(null);
    asr.reset();
  };

  useEffect(
    () => () => {
      if (recTimerRef.current !== null) clearInterval(recTimerRef.current);
      if (recStreamRef.current)
        recStreamRef.current.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const recountFromTranscript = () =>
    setSyllables(String(countSyllables(transcript)));

  const exportCSV = () => {
    if (tags.length === 0) return;
    const lines = ["time_sec,code,type,category"];
    for (const t of tags) {
      const meta = TYPES.find((tt) => tt.id === t.type);
      const cat = classifyTag(t.type, t.hasTension);
      lines.push(
        `${t.time.toFixed(2)},${meta?.code ?? t.type},${meta?.label ?? t.type}${t.hasTension ? "(긴장)" : ""},${cat}`,
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `pfa2_fluency_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---- 파생값 ----
  const syllablesNum = parseInt(syllables, 10);
  const validSyll = !isNaN(syllablesNum) && syllablesNum > 0;
  const counts: Record<DisfluencyType, number> = {
    H: 0, I: 0, UR: 0, R1: 0, R2: 0, DP: 0,
  };
  for (const tag of tags) counts[tag.type]++;
  const ndCount = tags.filter(
    (t) => classifyTag(t.type, t.hasTension) === "ND",
  ).length;
  const adCount = tags.filter(
    (t) => classifyTag(t.type, t.hasTension) === "AD",
  ).length;
  const AD_WEIGHT = 1.5;
  const ndScore = validSyll ? (ndCount / syllablesNum) * 100 : 0;
  const adScore = validSyll ? (adCount / syllablesNum) * 100 * AD_WEIGHT : 0;
  const totalScore = ndScore + adScore;

  // 타임라인 마커: 확정 태그(진하게) + 미처리 자동탐지 후보(흐리게)
  const markers: TimelineMarker[] = [
    ...tags.map((t) => ({
      time: t.time,
      color: TYPES.find((tt) => tt.id === t.type)?.hex ?? "#64748b",
    })),
    ...detected
      .map((ev, idx) => ({ ev, idx }))
      .filter(({ idx }) => !accepted.has(idx) && !dismissed.has(idx))
      .map(({ ev }) => ({
        time: ev.start,
        end: ev.end,
        color: ev.kind === "repetition" ? "#f43f5e" : "#b91c1c",
        faded: true,
      })),
  ];

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  const pendingCount = detected.filter(
    (_, idx) => !accepted.has(idx) && !dismissed.has(idx),
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Voice Lab 허브로
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            🟡 말 흐름
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">유창성 분석</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            녹음하거나 오디오 파일을 올린 뒤 <b>재생하며 천천히</b> 비유창을
            태그합니다. 음향 자동탐지가 반복2·비운율적 발성 후보를 타임라인에
            미리 표시하고, P-FA-II 기준 ND·AD 점수를 산출합니다.
          </p>
        </div>

        {micError && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {micError}
          </div>
        )}

        {/* ─── 입력 단계 ─── */}
        {stage === "input" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">① 마이크 녹음</h2>
              <p className="mt-1 text-xs text-slate-500">
                실시간 녹음 후 재생하며 분석합니다.
              </p>
              <div className="my-6 text-center">
                <div className="text-5xl font-bold tabular-nums text-slate-900">
                  {fmt(recElapsed)}
                </div>
              </div>
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="w-full rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  ● 녹음 시작
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-full animate-pulse rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  ■ 녹음 종료
                </button>
              )}
              {recording && asr.supported && (
                <p className="mt-3 min-h-[1.5rem] rounded bg-amber-50 px-2 py-1 text-xs text-slate-700">
                  {asr.finalTranscript}
                  <span className="text-slate-400"> {asr.interim}</span>
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                ② 오디오 파일 업로드
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                wav · mp3 · m4a · webm 등. 브라우저에서 처리, 서버 업로드 없음.
              </p>
              <label className="mt-6 flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-amber-400 hover:bg-amber-50">
                <span className="text-3xl">📁</span>
                <span className="mt-2 text-sm text-slate-600">
                  파일 선택 또는 끌어다 놓기
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={onFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {stage === "analyzing" && (
          <div className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-600">
              오디오 디코딩 + 음향 비유창 탐지 중…
            </p>
          </div>
        )}

        {/* ─── 검토 단계 ─── */}
        {stage === "review" && (
          <>
            <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  재생 + 타임라인 분석
                </h2>
                <button
                  onClick={reset}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  새 분석
                </button>
              </div>

              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (isFinite(d) && d > 0) setDuration(d);
                  }}
                  className="hidden"
                />
              )}

              <WaveformTimeline
                peaks={peaks}
                duration={duration}
                currentTime={currentTime}
                markers={markers}
                onSeek={seek}
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  {playing ? "⏸ 일시정지" : "▶ 재생"}
                </button>
                <span className="font-mono text-sm tabular-nums text-slate-600">
                  {currentTime.toFixed(1)} / {duration.toFixed(1)}s
                </span>
                <span className="text-xs text-slate-400">
                  파형 클릭으로 이동 · Space 재생/정지
                </span>
              </div>

              {/* 태그 버튼 */}
              <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-600">
                  현재 위치 <b className="font-mono">{currentTime.toFixed(2)}s</b>{" "}
                  에 태그 추가 (키 1–6)
                </span>
                <button
                  onClick={() => setTensionMode((v) => !v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tensionMode
                      ? "bg-rose-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  title="질적 양상(긴장) 토글 — ND→AD (키 0/T)"
                >
                  {tensionMode ? "● 긴장 ON" : "긴장 OFF"}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      addTagAt(t.id, audioRef.current?.currentTime ?? 0)
                    }
                    className={`flex flex-col items-center rounded-xl p-2.5 text-white transition ${t.color}`}
                    title={`${t.label} ${t.code} · ${t.baseCategory} (키 ${t.key})`}
                  >
                    <span className="text-sm font-bold">{t.code}</span>
                    <span className="mt-0.5 text-[11px]">
                      [{t.key}] {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 자동탐지 후보 */}
            {(pendingCount > 0 || accepted.size > 0 || dismissed.size > 0) && (
              <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    음향 자동 탐지 후보 ({pendingCount}건 대기)
                  </h3>
                  {pendingCount > 0 && (
                    <button
                      onClick={acceptAllDetections}
                      className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
                    >
                      남은 후보 모두 채택
                    </button>
                  )}
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  타임라인에 흐린 마커로 표시됩니다. 재생/청취 확인 후
                  채택하세요 (반복→R2, 연장·막힘→DP, 모두 AD).
                </p>
                <div className="space-y-2">
                  {detected.map((ev, idx) => {
                    if (accepted.has(idx) || dismissed.has(idx)) return null;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${
                            ev.kind === "repetition"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {KIND_LABEL[ev.kind]}
                        </span>
                        <button
                          onClick={() => seek(ev.start)}
                          className="font-mono text-xs tabular-nums text-violet-700 underline"
                        >
                          {ev.start.toFixed(2)}–{ev.end.toFixed(2)}s ▶
                        </button>
                        <span className="flex-1 text-xs text-slate-600">
                          {ev.detail} · {(ev.confidence * 100).toFixed(0)}%
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => acceptDetection(idx)}
                            className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            채택
                          </button>
                          <button
                            onClick={() => dismissDetection(idx)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                          >
                            기각
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {pendingCount === 0 && (
                    <p className="py-2 text-center text-xs text-slate-400">
                      대기 중인 후보 없음 (채택 {accepted.size} · 기각{" "}
                      {dismissed.size})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 태그 목록 */}
            {tags.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    태그 ({tags.length}건)
                  </h3>
                  <button
                    onClick={exportCSV}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    CSV 내보내기
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-2 pr-3">시간</th>
                        <th className="py-2 pr-3">유형</th>
                        <th className="py-2 pr-3">범주</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tags.map((tag) => {
                        const meta = TYPES.find((t) => t.id === tag.type);
                        const cat = classifyTag(tag.type, tag.hasTension);
                        const canTension = meta?.baseCategory === "ND";
                        return (
                          <tr key={tag.id} className="border-b border-slate-100">
                            <td className="py-1.5 pr-3">
                              <button
                                onClick={() => seek(tag.time)}
                                className="font-mono tabular-nums text-violet-700 underline"
                              >
                                {tag.time.toFixed(2)}s
                              </button>
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              <span className="font-mono text-xs text-slate-500">
                                {meta?.code}
                              </span>{" "}
                              {meta?.label}
                              {tag.hasTension && (
                                <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800">
                                  긴장
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  cat === "AD"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {cat}
                              </span>
                            </td>
                            <td className="py-1.5 text-right">
                              {canTension && (
                                <button
                                  onClick={() => toggleTagTension(tag.id)}
                                  className="mr-2 text-xs text-slate-400 hover:text-amber-600"
                                  title="긴장 토글 → ND/AD 전환"
                                >
                                  긴장↕
                                </button>
                              )}
                              <button
                                onClick={() => removeTag(tag.id)}
                                className="text-xs text-slate-400 hover:text-rose-600"
                              >
                                제거
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 전사 + 점수 */}
            <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">
                P-FA-II 점수 산출
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">
                <ResultBox label="전체" value={`${tags.length} 회`} />
                <ResultBox
                  label="비정상적 (AD)"
                  value={`${adCount} 회`}
                  accent="rose"
                />
                <ResultBox
                  label="정상적 (ND)"
                  value={`${ndCount} 회`}
                  accent="blue"
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {TYPES.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-lg border px-3 py-2 text-center ${
                      t.baseCategory === "AD"
                        ? "border-rose-200 bg-rose-50"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <p className="text-xs text-slate-600">
                      <span className="font-mono">{t.code}</span> {t.label}
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                      {counts[t.id]}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <label className="mb-1 block text-sm font-medium text-amber-900">
                  전사 (붙여넣기/수정 가능 — 목표음절수 자동 산출)
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={3}
                  placeholder="전사 텍스트를 붙여넣거나 입력하세요. 녹음 시 음성 인식 결과가 자동으로 채워집니다."
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-amber-900">
                    목표 음절 수
                  </label>
                  <button
                    onClick={recountFromTranscript}
                    className="rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    전사 → 음절 수 재계산
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  value={syllables}
                  onChange={(e) => setSyllables(e.target.value)}
                  placeholder="예: 87"
                  className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-lg font-semibold tabular-nums focus:border-amber-600 focus:outline-none"
                />

                {validSyll && (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <ResultBox
                        label="ND 점수"
                        value={ndScore.toFixed(2)}
                        sub={`${ndCount} / ${syllablesNum} × 100`}
                        accent="blue"
                      />
                      <ResultBox
                        label="AD 점수 (×1.5)"
                        value={adScore.toFixed(2)}
                        sub={`${adCount} / ${syllablesNum} × 100 × 1.5`}
                        accent="rose"
                      />
                      <ResultBox
                        label="총점 (필수과제)"
                        value={totalScore.toFixed(2)}
                        sub="ND점수 + AD점수"
                        accent="amber"
                        highlight
                      />
                    </div>
                    <p className="mt-3 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs text-amber-900">
                      ⓘ 백분위·중증도(약함/중간/심함)는 P-FA-II <b>지침서의
                      연령대별 규준표</b>에 총점을 대조해 판정하세요. AD
                      가중치(×1.5)는 지침서 산출식 기준입니다.
                    </p>
                    <div className="mt-4">
                      <SaveToHistory
                        moduleId="fluency"
                        summary={{
                          목표음절수: syllablesNum,
                          ND점수: +ndScore.toFixed(2),
                          AD점수: +adScore.toFixed(2),
                          총점: +totalScore.toFixed(2),
                          ND빈도: ndCount,
                          AD빈도: adCount,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            비유창 유형 설명 + 근거
          </summary>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {TYPES.map((t) => (
              <div key={t.id} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px] font-bold text-white ${t.color.split(" ")[0]}`}
                >
                  {t.key}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">
                    <span className="font-mono text-xs text-slate-500">
                      {t.code}
                    </span>{" "}
                    {t.label}
                    {t.baseCategory === "AD" ? (
                      <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                        AD 비정상적
                      </span>
                    ) : (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                        ND 정상적
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">{t.description}</p>
                </div>
              </div>
            ))}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">질적 양상(긴장) 처리</p>
              ND 유형이라도 긴장·탈출행동 등 질적 양상이 동반되면 AD 로
              산정합니다. 0/T 키 또는 토글 버튼으로 표시하고, 태그 목록에서
              「긴장↕」로 개별 전환할 수 있습니다.
            </div>
            <p className="mt-3 text-xs text-slate-500">
              근거: 심현섭·신문자·이은주 (2010) 파라다이스-유창성 검사 II
              (P-FA-II). AD 가중치(×1.5)·연령대별 규준은 지침서 기준.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}

function ResultBox({
  label,
  value,
  sub,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "rose" | "blue" | "amber";
  highlight?: boolean;
}) {
  const accents: Record<string, string> = {
    rose: highlight ? "border-rose-400 bg-rose-50" : "border-rose-200 bg-white",
    blue: highlight ? "border-blue-400 bg-blue-50" : "border-blue-200 bg-white",
    amber: highlight
      ? "border-amber-400 bg-amber-50"
      : "border-amber-200 bg-white",
  };
  const cls = accent
    ? accents[accent]
    : highlight
      ? "border-slate-400 bg-white"
      : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
