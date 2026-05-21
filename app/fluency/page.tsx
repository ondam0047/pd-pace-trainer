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

// P-FA-II (파라다이스-유창성 검사 II) 비유창성 유형
//  - ND (정상적 비유창): 주저(H)·간투사(I)·미완성/수정(UR)·반복1(R1)
//  - AD (비정상적 비유창): 반복2(R2)·비운율적 발성(DP)
//  - ND 유형도 질적 양상(긴장·탈출행동) 동반 시 AD 로 산정 (hasTension)
type DisfluencyType = "H" | "I" | "UR" | "R1" | "R2" | "DP";

const TYPES: {
  id: DisfluencyType;
  code: string;
  label: string;
  shortLabel: string;
  key: string;
  baseCategory: "ND" | "AD"; // 질적 양상 없을 때의 기본 범주
  description: string;
  color: string;
}[] = [
  {
    id: "H",
    code: "H",
    label: "주저",
    shortLabel: "H",
    key: "1",
    baseCategory: "ND",
    description: "1~3초 정도 머뭇거림 (예: … 그게)",
    color: "bg-sky-500 hover:bg-sky-600",
  },
  {
    id: "I",
    code: "I",
    label: "간투사",
    shortLabel: "I",
    key: "2",
    baseCategory: "ND",
    description: "의미 없는 삽입어 (예: 음·어·그)",
    color: "bg-cyan-500 hover:bg-cyan-600",
  },
  {
    id: "UR",
    code: "U/Ur",
    label: "미완성·수정",
    shortLabel: "UR",
    key: "3",
    baseCategory: "ND",
    description: "발화 미완성 또는 수정 (예: 난 아니 제가)",
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    id: "R1",
    code: "R1",
    label: "반복1",
    shortLabel: "R1",
    key: "4",
    baseCategory: "ND",
    description: "다음절 낱말·구·어절 반복 (예: 어제-어제)",
    color: "bg-teal-500 hover:bg-teal-600",
  },
  {
    id: "R2",
    code: "R2",
    label: "반복2",
    shortLabel: "R2",
    key: "5",
    baseCategory: "AD",
    description: "음절·낱말부분·일음절 낱말 반복 (예: 지-지-지구)",
    color: "bg-rose-500 hover:bg-rose-600",
  },
  {
    id: "DP",
    code: "DP",
    label: "비운율적 발성",
    shortLabel: "DP",
    key: "6",
    baseCategory: "AD",
    description: "연장·막힘·깨진 낱말 (예: 나—는, 소리 없이 막힘)",
    color: "bg-red-700 hover:bg-red-800",
  },
];

// 한 태그의 P-FA-II 범주 결정 (질적 양상 동반 시 ND→AD)
function classifyTag(type: DisfluencyType, hasTension: boolean): "ND" | "AD" {
  const def = TYPES.find((t) => t.id === type);
  if (!def) return "ND";
  if (def.baseCategory === "AD") return "AD";
  return hasTension ? "AD" : "ND";
}

type Tag = {
  time: number;
  type: DisfluencyType;
  hasTension: boolean;
  timestamp: number;
};

export default function FluencyPage() {
  const [phase, setPhase] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [tags, setTags] = useState<Tag[]>([]);
  const [syllables, setSyllables] = useState<string>("");
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [autoFilled, setAutoFilled] = useState(false);
  const [detected, setDetected] = useState<DetectedDisfluency[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [tensionMode, setTensionMode] = useState(false);

  const asr = useKoreanASR();

  const startTimeRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const phaseRef = useRef<"idle" | "recording" | "done">("idle");
  const tensionRef = useRef(false);

  useEffect(() => {
    tensionRef.current = tensionMode;
  }, [tensionMode]);

  // 오디오 녹음 (음향 비유창 탐지용)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedRef = useRef<Float32Array[]>([]);

  const stopAudio = useCallback(() => {
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

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const start = useCallback(async () => {
    setElapsed(0);
    setTags([]);
    setSyllables("");
    setEditedTranscript("");
    setAutoFilled(false);
    setDetected([]);
    setDismissed(new Set());
    setAccepted(new Set());
    setMicError(null);
    recordedRef.current = [];

    // 오디오 캡처 시작
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
    } catch (err) {
      console.error(err);
      setMicError(
        "마이크 접근 실패 — 음향 자동 탐지는 비활성화됩니다. 수동 태깅은 사용 가능합니다.",
      );
    }

    phaseRef.current = "recording";
    setPhase("recording");
    startTimeRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      setElapsed((performance.now() - startTimeRef.current) / 1000);
    }, 100);
    if (asr.supported) asr.start();
  }, [asr]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    phaseRef.current = "done";
    setPhase("done");
    asr.stop();

    // 녹음 버퍼 합치고 음향 비유창 탐지
    const sr = audioCtxRef.current?.sampleRate ?? 44100;
    stopAudio();
    const totalLen = recordedRef.current.reduce((s, b) => s + b.length, 0);
    if (totalLen > 0) {
      setAnalyzing(true);
      const combined = new Float32Array(totalLen);
      let offset = 0;
      for (const b of recordedRef.current) {
        combined.set(b, offset);
        offset += b.length;
      }
      // 무거운 계산 — 다음 틱으로 미뤄 UI 블로킹 최소화
      setTimeout(() => {
        try {
          const events = detectDisfluencies(combined, sr);
          setDetected(events);
        } catch (err) {
          console.error("비유창 탐지 실패", err);
        } finally {
          setAnalyzing(false);
        }
      }, 50);
    }
  }, [asr, stopAudio]);

  const addTag = useCallback((type: DisfluencyType) => {
    if (phaseRef.current !== "recording") return;
    const t = (performance.now() - startTimeRef.current) / 1000;
    setTags((prev) => [
      ...prev,
      { time: t, type, hasTension: tensionRef.current, timestamp: Date.now() },
    ]);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phaseRef.current !== "recording") return;
      // 0 / t = 질적 양상(긴장) 토글
      if (e.key === "0" || e.key === "t" || e.key === "T") {
        e.preventDefault();
        setTensionMode((v) => !v);
        return;
      }
      const type = TYPES.find((tt) => tt.key === e.key);
      if (type) {
        e.preventDefault();
        addTag(type.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addTag]);

  const removeTag = (idx: number) =>
    setTags((prev) => prev.filter((_, i) => i !== idx));

  const toggleTagTension = (idx: number) =>
    setTags((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, hasTension: !t.hasTension } : t,
      ),
    );

  const reset = () => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    stopAudio();
    recordedRef.current = [];
    phaseRef.current = "idle";
    setPhase("idle");
    setTags([]);
    setSyllables("");
    setEditedTranscript("");
    setAutoFilled(false);
    setDetected([]);
    setDismissed(new Set());
    setAccepted(new Set());
    setElapsed(0);
    setTensionMode(false);
    asr.reset();
  };

  // 탐지 후보 → 태그로 채택 (R2·DP 는 기본 AD)
  const acceptDetection = (idx: number) => {
    const ev = detected[idx];
    if (!ev) return;
    const type = KIND_TO_TAG[ev.kind] as DisfluencyType;
    setTags((prev) =>
      [
        ...prev,
        { time: ev.start, type, hasTension: false, timestamp: Date.now() + idx },
      ].sort((a, b) => a.time - b.time),
    );
    setAccepted((prev) => new Set(prev).add(idx));
  };

  const dismissDetection = (idx: number) => {
    setDismissed((prev) => new Set(prev).add(idx));
  };

  const acceptAllDetections = () => {
    detected.forEach((_, idx) => {
      if (!accepted.has(idx) && !dismissed.has(idx)) acceptDetection(idx);
    });
  };

  useEffect(() => () => stopAudio(), [stopAudio]);

  // 세션 종료 시 ASR 전사로부터 음절 수 자동 산출
  useEffect(() => {
    if (phase !== "done") return;
    if (!asr.supported) return;
    const finalText = normalizeTranscript(asr.finalTranscript);
    if (autoFilled || !finalText) return;
    setEditedTranscript(finalText);
    setSyllables(String(countSyllables(finalText)));
    setAutoFilled(true);
  }, [phase, asr.finalTranscript, asr.supported, autoFilled]);

  const recountFromEdited = () => {
    setSyllables(String(countSyllables(editedTranscript)));
  };

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    },
    [],
  );

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

  const syllablesNum = parseInt(syllables, 10);
  const validSyll = !isNaN(syllablesNum) && syllablesNum > 0;

  // 유형별 빈도
  const counts: Record<DisfluencyType, number> = {
    H: 0, I: 0, UR: 0, R1: 0, R2: 0, DP: 0,
  };
  for (const tag of tags) counts[tag.type]++;

  // P-FA-II 범주별 빈도 (질적 양상 반영)
  const ndCount = tags.filter(
    (t) => classifyTag(t.type, t.hasTension) === "ND",
  ).length;
  const adCount = tags.filter(
    (t) => classifyTag(t.type, t.hasTension) === "AD",
  ).length;

  // P-FA-II 점수: ND점수 = ND빈도/목표음절×100,
  //               AD점수 = AD빈도/목표음절×100×1.5,
  //               총점 = ND점수 + AD점수
  const AD_WEIGHT = 1.5;
  const ndScore = validSyll ? (ndCount / syllablesNum) * 100 : 0;
  const adScore = validSyll ? (adCount / syllablesNum) * 100 * AD_WEIGHT : 0;
  const totalScore = ndScore + adScore;

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);

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
            유창성 분석
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            P-FA-II 기준 비유창 유형(ND 4종·AD 2종)을 실시간 태그하면
            ND점수·AD점수(×1.5)·총점을 자동 산출합니다. 키보드 1–6 또는
            버튼으로 태그, <b>0/T 키로 질적 양상(긴장) 토글</b>. 세션 종료 후
            음향 분석이 반복2·비운율적발성 후보를 자동 제안합니다 (검토 필수).
          </p>
        </div>

        {micError && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {micError}
          </div>
        )}

        {/* 명령 키 레이아웃 + 타이머 */}
        <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">세션 녹화</h2>
              <p className="text-xs text-slate-500">키보드 1–6 태그 · 0/T 긴장 토글 · 버튼 클릭</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                phase === "idle"
                  ? "bg-slate-100 text-slate-600"
                  : phase === "recording"
                    ? "animate-pulse bg-rose-100 text-rose-900"
                    : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {phase === "idle" && "대기"}
              {phase === "recording" && "● 녹화 중"}
              {phase === "done" && "✓ 완료"}
            </span>
          </div>

          <div className="my-6 text-center">
            <div className="text-6xl font-bold tabular-nums text-slate-900">
              {mm.toString().padStart(2, "0")}:{ss.toString().padStart(2, "0")}
            </div>
          </div>

          {phase === "idle" && (
            <button
              onClick={start}
              className="w-full rounded-xl bg-amber-600 px-6 py-4 text-lg font-semibold text-white hover:bg-amber-700"
            >
              세션 시작
            </button>
          )}
          {phase === "recording" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-600">
                  ND 4종 = 파랑 계열 · AD 2종 = 빨강 계열
                </span>
                <button
                  onClick={() => setTensionMode((v) => !v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tensionMode
                      ? "bg-rose-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  title="질적 양상(긴장) 토글 — 켜면 ND 유형도 AD 로 산정 (키 0/T)"
                >
                  {tensionMode ? "● 질적 양상(긴장) ON" : "질적 양상(긴장) OFF"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => addTag(t.id)}
                    className={`flex flex-col items-center rounded-xl p-3 text-white transition ${t.color}`}
                    title={`${t.label} ${t.code} · ${t.baseCategory} (키 ${t.key})`}
                  >
                    <span className="text-2xl font-bold">{t.shortLabel}</span>
                    <span className="mt-1 text-[11px]">[{t.key}] {t.label}</span>
                  </button>
                ))}
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
                onClick={stop}
                className="w-full rounded-xl bg-slate-700 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                세션 종료 + 결과 보기
              </button>
            </div>
          )}
          {phase === "done" && (
            <div className="space-y-3">
              <button
                onClick={start}
                className="w-full rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
              >
                새 세션
              </button>
              <button
                onClick={reset}
                className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                전체 초기화
              </button>
            </div>
          )}
        </div>

        {/* 음향 자동 탐지 후보 */}
        {phase === "done" && (analyzing || detected.length > 0) && (
          <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                음향 자동 탐지 후보
              </h3>
              {detected.length > 0 && (
                <button
                  onClick={acceptAllDetections}
                  className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
                >
                  남은 후보 모두 채택
                </button>
              )}
            </div>
            <p className="mb-3 text-xs text-slate-500">
              파형을 직접 분석한 결과입니다 (ASR 아님). 반드시 청취 확인 후
              채택하세요 — 빠른 정상 발화·잡음에서 오탐 가능.
            </p>

            {analyzing && (
              <p className="py-4 text-center text-sm text-slate-500">
                음향 분석 중…
              </p>
            )}

            {!analyzing && detected.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-500">
                탐지된 비유창 후보 없음.
              </p>
            )}

            {!analyzing && detected.length > 0 && (
              <div className="space-y-2">
                {detected.map((ev, idx) => {
                  const isAccepted = accepted.has(idx);
                  const isDismissed = dismissed.has(idx);
                  const kindColor =
                    ev.kind === "repetition"
                      ? "bg-rose-100 text-rose-800"
                      : ev.kind === "prolongation"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-red-100 text-red-800";
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        isDismissed
                          ? "border-slate-200 bg-slate-50 opacity-50"
                          : isAccepted
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold ${kindColor}`}
                      >
                        {KIND_LABEL[ev.kind]}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-slate-600">
                        {ev.start.toFixed(2)}–{ev.end.toFixed(2)}s
                      </span>
                      <span className="flex-1 text-xs text-slate-600">
                        {ev.detail} · 신뢰도 {(ev.confidence * 100).toFixed(0)}%
                      </span>
                      {isAccepted ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          ✓ 채택됨
                        </span>
                      ) : isDismissed ? (
                        <span className="text-xs text-slate-400">기각됨</span>
                      ) : (
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
                      )}
                    </div>
                  );
                })}
                <p className="mt-2 text-xs text-slate-500">
                  채택 시 「반복→반복2(R2)」 「연장·막힘→비운율적 발성(DP)」 으로
                  태그에 추가됩니다(둘 다 AD). 다음절 낱말·구 반복(R1)이면 채택
                  후 태그에서 수정하세요.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 태그 리스트 */}
        {tags.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                실시간 태그 ({tags.length}건)
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
                  {tags
                    .slice()
                    .reverse()
                    .map((tag, i) => {
                      const meta = TYPES.find((t) => t.id === tag.type);
                      const realIdx = tags.length - 1 - i;
                      const cat = classifyTag(tag.type, tag.hasTension);
                      const canTension = meta?.baseCategory === "ND";
                      return (
                        <tr
                          key={tag.timestamp}
                          className="border-b border-slate-100"
                        >
                          <td className="py-1.5 pr-3 font-mono tabular-nums text-slate-700">
                            {tag.time.toFixed(2)}s
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
                                onClick={() => toggleTagTension(realIdx)}
                                className="mr-2 text-xs text-slate-400 hover:text-amber-600"
                                title="질적 양상(긴장) 토글 → ND/AD 전환"
                              >
                                긴장↕
                              </button>
                            )}
                            <button
                              onClick={() => removeTag(realIdx)}
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

        {/* 결과 */}
        {phase === "done" && tags.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-slate-900">분석 결과</h3>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultBox
                label="발생 횟수 전체"
                value={`${tags.length} 회`}
              />
              <ResultBox
                label="비정상적 비유창 (AD)"
                value={`${adCount} 회`}
                accent="rose"
              />
              <ResultBox
                label="정상적 비유창 (ND)"
                value={`${ndCount} 회`}
                accent="blue"
              />
              <ResultBox
                label="세션 녹화 시간"
                value={`${elapsed.toFixed(1)} 초`}
              />
            </div>

            <h4 className="mt-5 mb-2 text-sm font-semibold text-slate-700">
              유형별 횟수 (P-FA-II 코드)
            </h4>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
              <h4 className="mb-3 text-sm font-semibold text-amber-900">
                P-FA-II 점수 산출 (목표음절수 기준)
              </h4>
              {asr.supported ? (
                <div className="mb-3 space-y-2">
                  <label className="block text-sm font-medium text-amber-900">
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
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                  <div className="flex items-center justify-between text-xs text-amber-900">
                    <span>Web Speech API (Chrome/Edge) · 한국어 인식</span>
                    <button
                      onClick={recountFromEdited}
                      className="rounded border border-amber-300 bg-white px-2 py-1 font-medium text-amber-800 hover:bg-amber-100"
                    >
                      전사 → 음절 수 재계산
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mb-3 text-xs text-amber-900">
                  이 브라우저는 음성 인식을 지원하지 않습니다. Chrome/Edge
                  사용을 권장합니다. 직접 음절 수를 입력하세요.
                </p>
              )}
              <label className="mb-2 block text-sm font-medium text-amber-900">
                목표 음절 수 (자동 카운트, 수정 가능)
              </label>
              <input
                type="number"
                min="1"
                value={syllables}
                onChange={(e) => setSyllables(e.target.value)}
                placeholder="예: 87"
                className="w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-lg font-semibold tabular-nums focus:border-amber-600 focus:outline-none"
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
                    연령대별 규준표</b>에 총점을 대조해 판정하세요. 규준표는
                    저작권 자료라 본 도구에 포함하지 않았습니다. AD 가중치(×1.5)는
                    지침서 산출식 기준이며, 사용 중인 지침서와 대조 확인을
                    권장합니다.
                  </p>
                  <div className="mt-4">
                    <SaveToHistory
                      moduleId="fluency"
                      summary={{
                        "목표음절수": syllablesNum,
                        "ND점수": +ndScore.toFixed(2),
                        "AD점수": +adScore.toFixed(2),
                        "총점": +totalScore.toFixed(2),
                        "ND빈도": ndCount,
                        "AD빈도": adCount,
                        "녹화시간(초)": +elapsed.toFixed(1),
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
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
              ND 유형(주저·간투사·미완성/수정·반복1)이라도 긴장·탈출행동 등
              질적 양상이 동반되면 AD 로 산정합니다. 녹화 중 0/T 키 또는
              토글 버튼으로 표시하고, 태그 목록에서 「긴장↕」로 개별 전환할 수
              있습니다.
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
