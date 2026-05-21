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
} from "@/components/fluency/disfluencyDetector";
import { tagFromTranscript } from "@/components/fluency/transcriptTagger";
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
  color: string;
  hex: string;
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

type TagSource = "manual" | "acoustic" | "transcript";
type Tag = {
  id: number;
  time: number;
  type: DisfluencyType;
  hasTension: boolean;
  source: TagSource;
  reviewed: boolean; // false = 자동 1차 초안(검토 필요)
  note?: string;
};

const SOURCE_LABEL: Record<TagSource, string> = {
  manual: "수동",
  acoustic: "음향",
  transcript: "전사",
};

type Stage = "input" | "analyzing" | "review";

const EXAMPLE_TRANSCRIPT = "음 어제 하- 아니 학교 에-에-에서 친구를 마- 만났-만났어요";

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
  const [tensionMode, setTensionMode] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [syllables, setSyllables] = useState("");

  // 보고서 정보
  const [clientName, setClientName] = useState("");
  const [evaluator, setEvaluator] = useState("");
  const [examDate, setExamDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [taskName, setTaskName] = useState("자발화");
  const [severity, setSeverity] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const asr = useKoreanASR();
  const tagIdRef = useRef(1);
  const nextId = () => tagIdRef.current++;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const recStartRef = useRef(0);

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

  // 오디오 → 디코드 + 파형 + 1차 자동 태깅(음향 + 전사)
  const handleAudioBlob = useCallback(
    async (blob: Blob, seedTranscript?: string, seedSyll?: string) => {
      const url = URL.createObjectURL(blob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      if (seedTranscript !== undefined) setTranscript(seedTranscript);
      if (seedSyll !== undefined) setSyllables(seedSyll);
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
        const dur = audioBuf.duration;
        await ctx.close();

        setPeaks(computePeaks(data, 1400));
        setDuration(dur);
        setCurrentTime(0);

        setTimeout(() => {
          const drafts: Tag[] = [];
          try {
            // 겹치는 음향 후보는 0.4s 창에서 신뢰도 높은 1건으로 합침
            const events = [...detectDisfluencies(data, sr)].sort(
              (a, b) => a.start - b.start,
            );
            let lastKept = -Infinity;
            for (const ev of events) {
              if (ev.start - lastKept < 0.4) continue;
              lastKept = ev.start;
              drafts.push({
                id: nextId(),
                time: ev.start,
                type: KIND_TO_TAG[ev.kind] as DisfluencyType,
                hasTension: false,
                source: "acoustic",
                reviewed: false,
                note: `음향: ${KIND_LABEL[ev.kind]} · ${ev.detail} (${(ev.confidence * 100).toFixed(0)}%)`,
              });
            }
          } catch (err) {
            console.error("음향 탐지 실패", err);
          }
          const tText = seedTranscript ?? "";
          if (tText.trim()) {
            for (const d of tagFromTranscript(tText, dur)) {
              drafts.push({
                id: nextId(),
                time: d.time,
                type: d.type,
                hasTension: false,
                source: "transcript",
                reviewed: false,
                note: d.note,
              });
            }
          }
          drafts.sort((a, b) => a.time - b.time);
          setTags(drafts);
          setStage("review");
        }, 30);
      } catch (err) {
        console.error("오디오 디코딩 실패", err);
        setMicError("오디오를 디코딩할 수 없습니다. 다른 파일을 시도하세요.");
        setStage("input");
      }
    },
    [],
  );

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
      setMicError("마이크 접근 실패 — 오디오 파일 업로드를 사용하세요.");
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

  // 녹음 종료 후 ASR 전사 자동 채움 (참고용 — verbatim 아닐 수 있음)
  useEffect(() => {
    if (stage !== "review" || !asr.supported) return;
    const finalText = normalizeTranscript(asr.finalTranscript);
    if (!finalText) return;
    setTranscript((prev) => prev || finalText);
    setSyllables((prev) => prev || String(countSyllables(finalText)));
  }, [stage, asr.finalTranscript, asr.supported]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMicError(null);
    handleAudioBlob(file);
  };

  const loadExample = useCallback(async () => {
    setMicError(null);
    try {
      const res = await fetch("/samples/fluency-sample.wav");
      if (!res.ok) throw new Error("sample fetch failed");
      const blob = await res.blob();
      setClientName((c) => c || "예시 (합성)");
      setTaskName("문장 따라말하기");
      handleAudioBlob(blob, EXAMPLE_TRANSCRIPT, "13");
    } catch (err) {
      console.error(err);
      setMicError("예시 파일을 불러오지 못했습니다.");
    }
  }, [handleAudioBlob]);

  // 재생 헤드 (rAF)
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
        {
          id: tagIdRef.current++,
          time,
          type,
          hasTension: tensionRef.current,
          source: "manual" as TagSource,
          reviewed: true,
        },
      ].sort((a, b) => a.time - b.time),
    );
  }, []);

  // 키보드: 1-6 태그, 0/T 긴장, space 재생/정지
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (stageRef.current !== "review") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
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
      prev.map((t) =>
        t.id === id ? { ...t, hasTension: !t.hasTension, reviewed: true } : t,
      ),
    );
  const changeTagType = (id: number, type: DisfluencyType) =>
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, type, reviewed: true } : t)),
    );
  const confirmTag = (id: number) =>
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reviewed: true } : t)),
    );
  const confirmAll = () =>
    setTags((prev) => prev.map((t) => ({ ...t, reviewed: true })));
  const removeDrafts = () => setTags((prev) => prev.filter((t) => t.reviewed));

  const reanalyzeTranscript = () => {
    const drafts = tagFromTranscript(transcript, duration).map((d) => ({
      id: tagIdRef.current++,
      time: d.time,
      type: d.type,
      hasTension: false,
      source: "transcript" as TagSource,
      reviewed: false,
      note: d.note,
    }));
    setTags((prev) =>
      [
        ...prev.filter((t) => !(t.source === "transcript" && !t.reviewed)),
        ...drafts,
      ].sort((a, b) => a.time - b.time),
    );
  };

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
    const lines = ["time_sec,code,type,category,source,reviewed,note"];
    for (const t of tags) {
      const meta = TYPES.find((tt) => tt.id === t.type);
      const cat = classifyTag(t.type, t.hasTension);
      lines.push(
        `${t.time.toFixed(2)},${meta?.code ?? t.type},${meta?.label ?? t.type}${t.hasTension ? "(긴장)" : ""},${cat},${SOURCE_LABEL[t.source]},${t.reviewed ? 1 : 0},"${(t.note ?? "").replace(/"/g, "'")}"`,
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
  const counts: Record<DisfluencyType, number> = { H: 0, I: 0, UR: 0, R1: 0, R2: 0, DP: 0 };
  for (const tag of tags) counts[tag.type]++;
  const ndCount = tags.filter((t) => classifyTag(t.type, t.hasTension) === "ND").length;
  const adCount = tags.filter((t) => classifyTag(t.type, t.hasTension) === "AD").length;
  const AD_WEIGHT = 1.5;
  const ndScore = validSyll ? (ndCount / syllablesNum) * 100 : 0;
  const adScore = validSyll ? (adCount / syllablesNum) * 100 * AD_WEIGHT : 0;
  const totalScore = ndScore + adScore;
  const unreviewed = tags.filter((t) => !t.reviewed).length;

  const markers: TimelineMarker[] = tags.map((t) => ({
    time: t.time,
    color: TYPES.find((tt) => tt.id === t.type)?.hex ?? "#64748b",
    faded: !t.reviewed,
  }));

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 no-print">
          ← Voice Lab 허브로
        </Link>
        <div className="no-print">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            🟡 말 흐름
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            유창성 분석 (P-FA-II 채점 보조)
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            음성을 넣으면 <b>1차 자동 태깅</b>(음향 + 전사 기반)이 비유창 후보를
            깔아줍니다. 임상가는 백지에서 시작하지 않고 재생하며 <b>검토·수정</b>
            만 하면 되고, 곧바로 <b>P-FA-II 보고서</b>로 출력할 수 있습니다.
          </p>
          <div className="mt-3 max-w-3xl rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <b className="text-slate-700">도구의 역할</b> · ✅ 타임스탬프 태깅 ·
            음절 자동 카운트 · ND/AD·총점 자동 계산 · 음향/전사 1차 자동 태깅 ·
            보고서 출력 &nbsp;|&nbsp; ❌ 듣기·전사·임상 판단을 대체하지는 않음
            (자동 태그는 모두 “검토 필요” 상태로, 임상가 확인 전엔 초안입니다).
          </div>
        </div>

        {micError && (
          <div className="no-print rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {micError}
          </div>
        )}

        {/* ─── 입력 ─── */}
        {stage === "input" && (
          <>
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
                  <input type="file" accept="audio/*" onChange={onFile} className="hidden" />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  처음이라면 <b>합성 예시 음성</b>으로 자동 태깅 → 검토 → 보고서
                  흐름을 체험해 보세요. (로봇 음질의 데모용 샘플)
                </span>
                <button
                  onClick={loadExample}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                >
                  예시 비유창 음성 불러오기
                </button>
              </div>
            </div>
          </>
        )}

        {stage === "analyzing" && (
          <div className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-600">
              오디오 디코딩 + 1차 자동 태깅(음향·전사) 중…
            </p>
          </div>
        )}

        {/* ─── 검토 ─── */}
        {stage === "review" && (
          <>
            <div className="no-print rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  재생 + 타임라인 검토
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
                  파형 클릭 이동 · Space 재생/정지 · 흐린 마커 = 검토 전 초안
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-600">
                  현재 위치 <b className="font-mono">{currentTime.toFixed(2)}s</b> 에
                  태그 추가 (키 1–6)
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
                    onClick={() => addTagAt(t.id, audioRef.current?.currentTime ?? 0)}
                    className={`flex flex-col items-center rounded-xl p-2.5 text-white transition ${t.color}`}
                    title={`${t.label} ${t.code} · ${t.baseCategory} (키 ${t.key})`}
                  >
                    <span className="text-sm font-bold">{t.code}</span>
                    <span className="mt-0.5 text-[11px]">[{t.key}] {t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 자동 1차 태깅 안내 */}
            {unreviewed > 0 && (
              <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                <span>
                  🤖 <b>1차 자동 태깅 {unreviewed}건</b>이 검토 대기 중입니다.
                  재생하며 유형·위치를 확인하고 채택하거나 수정·삭제하세요.
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={confirmAll}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    모두 확인
                  </button>
                  <button
                    onClick={removeDrafts}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    초안 모두 삭제
                  </button>
                </div>
              </div>
            )}

            {/* 태그 목록 (검토/수정) */}
            {tags.length > 0 && (
              <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    태그 {tags.length}건{" "}
                    <span className="text-sm font-normal text-slate-500">
                      (검토 완료 {tags.length - unreviewed} · 초안 {unreviewed})
                    </span>
                  </h3>
                  <button
                    onClick={exportCSV}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    CSV 내보내기
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-2 pr-2">시간</th>
                        <th className="py-2 pr-2">유형 (수정)</th>
                        <th className="py-2 pr-2">범주</th>
                        <th className="py-2 pr-2">출처</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tags.map((tag) => {
                        const meta = TYPES.find((t) => t.id === tag.type);
                        const cat = classifyTag(tag.type, tag.hasTension);
                        const canTension = meta?.baseCategory === "ND";
                        return (
                          <tr
                            key={tag.id}
                            className={`border-b border-slate-100 ${
                              tag.reviewed ? "" : "bg-violet-50/60"
                            }`}
                          >
                            <td className="py-1.5 pr-2">
                              <button
                                onClick={() => seek(tag.time)}
                                className="font-mono tabular-nums text-violet-700 underline"
                              >
                                {tag.time.toFixed(2)}s
                              </button>
                            </td>
                            <td className="py-1.5 pr-2">
                              <select
                                value={tag.type}
                                onChange={(e) =>
                                  changeTagType(tag.id, e.target.value as DisfluencyType)
                                }
                                className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
                              >
                                {TYPES.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.code} {t.label}
                                  </option>
                                ))}
                              </select>
                              {tag.note && (
                                <span
                                  className="ml-1 text-[10px] text-slate-400"
                                  title={tag.note}
                                >
                                  ⓘ
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 pr-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  cat === "AD"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {cat}
                              </span>
                              {tag.hasTension && (
                                <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800">
                                  긴장
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 pr-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  tag.source === "manual"
                                    ? "bg-slate-100 text-slate-600"
                                    : tag.source === "acoustic"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-cyan-50 text-cyan-700"
                                }`}
                              >
                                {SOURCE_LABEL[tag.source]}
                              </span>
                            </td>
                            <td className="py-1.5 text-right whitespace-nowrap">
                              {!tag.reviewed && (
                                <button
                                  onClick={() => confirmTag(tag.id)}
                                  className="mr-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                                  title="이 자동 태그를 확인(채택)"
                                >
                                  ✓확인
                                </button>
                              )}
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

            {/* 전사 + 음절 */}
            <div className="no-print rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-amber-900">
                  Verbatim 전사 (비유창 포함 — 전사 기반 자동 태깅에 사용)
                </label>
                <button
                  onClick={reanalyzeTranscript}
                  disabled={!transcript.trim()}
                  className="rounded border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                >
                  전사로 재분석 (간투사·반복·수정)
                </button>
              </div>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                placeholder="예: 음 어제 하- 아니 학교 에-에-에서 친구를 만났-만났어요  (반복은 '-' 로, 간투사는 음·어 등으로 표기하면 자동 태깅 정확도가 올라갑니다)"
                className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <label className="text-sm font-medium text-amber-900">
                  목표 음절 수 (분모)
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
            </div>

            {/* ─── 보고서 ─── */}
            <div className="fl-report rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    파라다이스-유창성 검사 II (P-FA-II) 분석 보고서
                  </h2>
                  <p className="text-xs text-slate-500">
                    음향·전사 기반 1차 자동 태깅을 임상가가 검토·수정하여 산출
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="no-print rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  인쇄 / PDF 저장
                </button>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <ReportField label="대상자" value={clientName} onChange={setClientName} placeholder="이름 / ID" />
                <ReportField label="평가자" value={evaluator} onChange={setEvaluator} placeholder="평가자명" />
                <ReportField label="검사일" value={examDate} onChange={setExamDate} type="date" />
                <ReportField label="과제" value={taskName} onChange={setTaskName} placeholder="자발화 / 읽기 등" />
              </div>

              {unreviewed > 0 && (
                <p className="no-print mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠ 아직 검토되지 않은 자동 초안 {unreviewed}건이 점수에 포함되어
                  있습니다. 보고서 확정 전 위의 태그 목록에서 확인/수정하세요.
                </p>
              )}

              <div className="mt-5 overflow-x-auto">
                <table className="w-full border border-slate-300 text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="border border-slate-300 px-3 py-2">유형</th>
                      {TYPES.map((t) => (
                        <th key={t.id} className="border border-slate-300 px-2 py-2 text-center">
                          {t.code}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-2 py-2 text-center">계</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 text-slate-600">빈도</td>
                      {TYPES.map((t) => (
                        <td key={t.id} className="border border-slate-300 px-2 py-2 text-center tabular-nums">
                          {counts[t.id]}
                        </td>
                      ))}
                      <td className="border border-slate-300 px-2 py-2 text-center font-bold tabular-nums">
                        {tags.length}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 text-slate-600">범주</td>
                      {TYPES.map((t) => (
                        <td
                          key={t.id}
                          className={`border border-slate-300 px-2 py-2 text-center text-xs font-semibold ${
                            t.baseCategory === "AD" ? "text-rose-700" : "text-blue-700"
                          }`}
                        >
                          {t.baseCategory}
                        </td>
                      ))}
                      <td className="border border-slate-300 px-2 py-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <ResultBox label="목표 음절 수" value={validSyll ? `${syllablesNum}` : "-"} />
                <ResultBox label="ND 점수" value={validSyll ? ndScore.toFixed(2) : "-"} sub={`정상적 ${ndCount}회`} accent="blue" />
                <ResultBox label="AD 점수 (×1.5)" value={validSyll ? adScore.toFixed(2) : "-"} sub={`비정상적 ${adCount}회`} accent="rose" />
                <ResultBox label="총점 (필수과제)" value={validSyll ? totalScore.toFixed(2) : "-"} sub="ND + AD" accent="amber" highlight />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">중증도 (규준표 대조)</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">(규준표 대조 후 선택)</option>
                    <option value="약함">약함</option>
                    <option value="중간">중간</option>
                    <option value="심함">심함</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">백분위 / 비고</label>
                  <input
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="연령대 규준 백분위 등"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {tags.length > 0 && (
                <div className="mt-5">
                  <p className="mb-1 text-xs font-semibold text-slate-600">비유창 상세</p>
                  <table className="w-full border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="border border-slate-300 px-2 py-1">시간(s)</th>
                        <th className="border border-slate-300 px-2 py-1">유형</th>
                        <th className="border border-slate-300 px-2 py-1">범주</th>
                        <th className="border border-slate-300 px-2 py-1">근거/비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tags.map((t) => {
                        const meta = TYPES.find((m) => m.id === t.type);
                        return (
                          <tr key={t.id}>
                            <td className="border border-slate-300 px-2 py-1 tabular-nums">{t.time.toFixed(2)}</td>
                            <td className="border border-slate-300 px-2 py-1">
                              {meta?.code} {meta?.label}
                              {t.hasTension ? " (긴장)" : ""}
                            </td>
                            <td className="border border-slate-300 px-2 py-1">
                              {classifyTag(t.type, t.hasTension)}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-slate-500">
                              {t.note ?? (t.source === "manual" ? "임상가 직접 표기" : "")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                근거: 심현섭·신문자·이은주 (2010) 파라다이스-유창성 검사 II
                (P-FA-II). AD 가중치(×1.5)·연령대별 규준은 지침서 기준. 본
                보고서의 비유창 태그는 음향(파형) 및 전사 텍스트 기반 1차 자동
                탐지를 임상가가 검토·수정한 결과이며, 백분위·중증도는 지침서
                규준표 대조가 필요합니다.
              </p>
            </div>

            <div className="no-print">
              {validSyll && (
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
              )}
            </div>
          </>
        )}

        <details className="no-print rounded-lg border border-slate-200 bg-white px-4 py-3">
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
                    <span className="font-mono text-xs text-slate-500">{t.code}</span>{" "}
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
            <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <p className="font-semibold">1차 자동 태깅 동작 방식</p>
              음향 분석은 연장·막힘 → DP, 음절 반복 → R2 를 파형에서 직접
              탐지합니다. 전사(verbatim) 분석은 간투사·낱말/음절 반복·수정/거짓시작
              을 텍스트에서 탐지하되 위치는 음절 비율로 추정합니다. 모두 초안이며
              임상가 검토가 필수입니다.
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}

function ReportField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </div>
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
    amber: highlight ? "border-amber-400 bg-amber-50" : "border-amber-200 bg-white",
  };
  const cls = accent
    ? accents[accent]
    : highlight
      ? "border-slate-400 bg-white"
      : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
