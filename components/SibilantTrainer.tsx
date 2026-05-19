"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeSibilantSpectrum } from "./vocalTract/spectralMoments";
import AnatomicalDiagram, {
  type ArticulationState,
} from "./vocalTract/AnatomicalDiagram";

// 스펙트럼 중심 구간·조음 정보
// 근거: Jongman/Wayland/Wong (2000) JASA, Shadle (1991), Kong & Edwards (2016),
//        Park (2008) Korean fricatives, 이호영(1996)
type TargetId = "sh" | "palatalized" | "s" | "ss";

type TargetInfo = {
  id: TargetId;
  label: string;
  hangul: string;
  ipa: string;
  min: number;
  max: number;
  color: string;
  articulation: ArticulationState;
  description: string;
  tip: string;
};

const TARGETS: Record<TargetId, TargetInfo> = {
  sh: {
    id: "sh",
    label: "왜곡 /ʃ/",
    hangul: "—",
    ipa: "ʃ",
    min: 2800,
    max: 4500,
    color: "#f59e0b",
    articulation: {
      tongueTip: { x: 360, y: 260 },
      tongueBody: { x: 340, y: 240 },
      velumOpen: false,
      lipClosure: false,
      lipRounding: 0.5,
      highlight: { x: 343, y: 240, label: "혁을 너무 뒤로", color: "#f97316" },
    },
    description: "한국어에는 없는 음소. 아동이 ㅅ을 경구개에 접근시켜 자주 왜곡.",
    tip: "혁을 더 앞(치조)으로 옮기고 입술 둘굈 해제. /s/ 쪽으로 이동 유도.",
  },
  palatalized: {
    id: "palatalized",
    label: "구개음화 /ɕ/",
    hangul: "ㅅㅣ",
    ipa: "ɕ",
    min: 4500,
    max: 5500,
    color: "#a855f7",
    articulation: {
      tongueTip: { x: 365, y: 255 },
      tongueBody: { x: 338, y: 245 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 343, y: 245, label: "i/y 앞 자연 변이", color: "#a855f7" },
    },
    description: "ㅅ + ㅣ/ㅑ/ㅕ·ㅠ 조합에서 자연스러운 구개음화 변이. 잍소리·쉬각에서 대표적.",
    tip: "모음이 i/y 계열일 때만 조음 오류는 아님. /ㅣ/, /ㅑ/ 이외 모음 앞에서는 /s/ 영역으로 가야 함.",
  },
  s: {
    id: "s",
    label: "표준 /s/",
    hangul: "ㅅ",
    ipa: "s",
    min: 5500,
    max: 8500,
    color: "#10b981",
    articulation: {
      tongueTip: { x: 370, y: 252 },
      tongueBody: { x: 335, y: 268 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 372, y: 250, label: "좋은 통로", color: "#34d399" },
    },
    description: "평음 치조마찰음. 아동 조음 장애의 가장 흔한 목표 음소.",
    tip: "혁끓을 윗잊못 알에, 혁 양쪽은 윗어금니에 접접. 입술은 악간 옆으로 펼치면 centroid 더 높아짐.",
  },
  ss: {
    id: "ss",
    label: "경음 /s͈/",
    hangul: "ㅆ",
    ipa: "s͈",
    min: 5500,
    max: 9000,
    color: "#0d9488",
    articulation: {
      tongueTip: { x: 370, y: 252 },
      tongueBody: { x: 335, y: 268 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 372, y: 250, label: "긴장·알력 강", color: "#0d9488" },
    },
    description: "ㅅ의 경음. centroid 분포는 ㅅ과 유사하지만 지속시간·술단 계곡이 더 김.",
    tip: "centroid로 ㅅ·ㅆ 구별은 제한적. 구별은 지속시간(>120ms)·계곡(VOT)·강도로.",
  },
};

const GAUGE_MIN = 2000;
const GAUGE_MAX = 9500;
const EMA_ALPHA = 0.55;

type Stats = {
  samples: number;
  inS: number;
  inSh: number;
  inPal: number;
  centroidSum: number;
  centroidSqSum: number;
  histogram: number[];
};

const HIST_BUCKETS = 30;
const HIST_MIN = 2000;
const HIST_MAX = 9500;
const HIST_BUCKET_WIDTH = (HIST_MAX - HIST_MIN) / HIST_BUCKETS;

function freqToX(f: number, w: number, padL: number, padR: number): number {
  const inner = w - padL - padR;
  const ratio =
    (Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, f)) - GAUGE_MIN) /
    (GAUGE_MAX - GAUGE_MIN);
  return padL + inner * ratio;
}

function emptyStats(): Stats {
  return {
    samples: 0,
    inS: 0,
    inSh: 0,
    inPal: 0,
    centroidSum: 0,
    centroidSqSum: 0,
    histogram: new Array(HIST_BUCKETS).fill(0),
  };
}

export default function SibilantTrainer() {
  const [isRecording, setIsRecording] = useState(false);
  const [centroid, setCentroid] = useState<number | null>(null);
  const [isFricative, setIsFricative] = useState(false);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<TargetId>("s");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef<number | null>(null);
  const statsRef = useRef<Stats>(emptyStats());

  const stop = useCallback(() => {
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
    smoothRef.current = null;
    setIsRecording(false);
  }, []);

  const tick = useCallback(() => {
    const a = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!a || !ctx) return;
    const freq = new Float32Array(a.frequencyBinCount);
    a.getFloatFrequencyData(freq);
    const r = analyzeSibilantSpectrum(freq, ctx.sampleRate);

    if (r.isFricative) {
      const sm =
        smoothRef.current === null
          ? r.centroid
          : EMA_ALPHA * smoothRef.current + (1 - EMA_ALPHA) * r.centroid;
      smoothRef.current = sm;
      setCentroid(sm);
      setIsFricative(true);

      const s = statsRef.current;
      s.samples += 1;
      s.centroidSum += sm;
      s.centroidSqSum += sm * sm;
      if (sm >= TARGETS.s.min && sm <= TARGETS.s.max) s.inS += 1;
      else if (sm >= TARGETS.sh.min && sm <= TARGETS.sh.max) s.inSh += 1;
      else if (sm >= TARGETS.palatalized.min && sm <= TARGETS.palatalized.max)
        s.inPal += 1;
      // histogram
      if (sm >= HIST_MIN && sm < HIST_MAX) {
        const idx = Math.floor((sm - HIST_MIN) / HIST_BUCKET_WIDTH);
        s.histogram[idx] += 1;
      }
      setStats({ ...s, histogram: [...s.histogram] });
    } else {
      setIsFricative(false);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setErrorMsg(null);
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
      const a = ctx.createAnalyser();
      a.fftSize = 4096;
      a.smoothingTimeConstant = 0.3;
      analyserRef.current = a;
      source.connect(a);
      smoothRef.current = null;
      statsRef.current = emptyStats();
      setStats(emptyStats());
      setIsRecording(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근에 실패했습니다.");
    }
  }, [tick]);

  useEffect(() => () => stop(), [stop]);

  const reset = useCallback(() => {
    statsRef.current = emptyStats();
    setStats(emptyStats());
    smoothRef.current = null;
    setCentroid(null);
  }, []);

  const meanCentroid =
    stats.samples > 0 ? stats.centroidSum / stats.samples : 0;
  const sdCentroid =
    stats.samples > 1
      ? Math.sqrt(
          Math.max(
            0,
            stats.centroidSqSum / stats.samples - meanCentroid * meanCentroid,
          ),
        )
      : 0;

  const target = TARGETS[targetId];
  const currentZone = useMemo<TargetId | null>(() => {
    if (centroid === null || !isFricative) return null;
    if (centroid >= TARGETS.s.min && centroid <= TARGETS.s.max) return "s";
    if (centroid >= TARGETS.sh.min && centroid <= TARGETS.sh.max) return "sh";
    if (
      centroid >= TARGETS.palatalized.min &&
      centroid <= TARGETS.palatalized.max
    )
      return "palatalized";
    return null;
  }, [centroid, isFricative]);

  const feedback = useMemo(() => {
    if (!isFricative || centroid === null) {
      return {
        msg: "마찰음을 길게 내세요 (예: 쓬……)",
        color: "slate" as const,
      };
    }
    if (currentZone === targetId || (targetId === "ss" && currentZone === "s")) {
      return {
        msg: `✨ 좋아요! ${target.label} 구간입니다`,
        color: "emerald" as const,
      };
    }
    if (currentZone === null) {
      return {
        msg: "중간 영역 — 혁 위치를 조절해 보세요",
        color: "amber" as const,
      };
    }
    return {
      msg: `다른 구간(${TARGETS[currentZone].label})에 있습니다`,
      color: "rose" as const,
    };
  }, [isFricative, centroid, currentZone, targetId, target]);

  // Gauge geometry
  const W = 760;
  const H = 220;
  const PADL = 40;
  const PADR = 40;
  const PADT = 30;
  const PADB = 100;

  const zoneXs = (t: TargetInfo) => ({
    x1: freqToX(t.min, W, PADL, PADR),
    x2: freqToX(t.max, W, PADL, PADR),
  });

  const centroidX =
    centroid !== null ? freqToX(centroid, W, PADL, PADR) : null;
  const meanX =
    stats.samples > 5 ? freqToX(meanCentroid, W, PADL, PADR) : null;

  // Histogram geometry
  const histMax = Math.max(1, ...stats.histogram);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">
          마찰음 훈련 모드 — 스펙트럼 중심 기반
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          근거: Jongman/Wayland/Wong (2000), Shadle (1991), Kong & Edwards
          (2016), Park (2008). · 음소 수준이 가장 안정적. 단어·문장은
          forced alignment 없이는 일부 애매함 있음.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">목표 음소</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {(Object.keys(TARGETS) as TargetId[]).map((id) => {
              const t = TARGETS[id];
              const active = id === targetId;
              return (
                <button
                  key={id}
                  onClick={() => setTargetId(id)}
                  className={`px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  style={active ? { background: t.color } : undefined}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {!isRecording ? (
            <button
              onClick={start}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              훈련 시작
            </button>
          ) : (
            <button
              onClick={stop}
              className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              정지
            </button>
          )}
          <button
            onClick={reset}
            disabled={isRecording || stats.samples === 0}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            세션 초기화
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {/* Gauge + histogram */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-[560px]">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                <rect
                  x={PADL}
                  y={PADT}
                  width={W - PADL - PADR}
                  height={H - PADT - PADB}
                  fill="#f8fafc"
                  stroke="#cbd5e1"
                />
                {(Object.keys(TARGETS) as TargetId[]).map((id) => {
                  const t = TARGETS[id];
                  const { x1, x2 } = zoneXs(t);
                  return (
                    <g key={id}>
                      <rect
                        x={x1}
                        y={PADT}
                        width={x2 - x1}
                        height={H - PADT - PADB}
                        fill={t.color}
                        opacity={id === targetId ? 0.35 : 0.16}
                      />
                      <text
                        x={(x1 + x2) / 2}
                        y={PADT + 16}
                        textAnchor="middle"
                        fontSize={13}
                        fontWeight={700}
                        fill={t.color}
                      >
                        {t.label}
                      </text>
                    </g>
                  );
                })}

                {/* axis ticks */}
                {[2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000].map((f) => {
                  const x = freqToX(f, W, PADL, PADR);
                  return (
                    <g key={f}>
                      <line
                        x1={x}
                        x2={x}
                        y1={H - PADB}
                        y2={H - PADB + 5}
                        stroke="#94a3b8"
                      />
                      <text
                        x={x}
                        y={H - PADB + 20}
                        textAnchor="middle"
                        fontSize={12}
                        fill="#475569"
                      >
                        {f}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={W / 2}
                  y={H - PADB + 38}
                  textAnchor="middle"
                  fontSize={13}
                  fill="#334155"
                  fontWeight={500}
                >
                  스펙트럼 중심 (Hz)
                </text>

                {/* histogram bars (하단) */}
                {stats.histogram.map((count, i) => {
                  if (count === 0) return null;
                  const x =
                    freqToX(HIST_MIN + i * HIST_BUCKET_WIDTH, W, PADL, PADR);
                  const xNext = freqToX(
                    HIST_MIN + (i + 1) * HIST_BUCKET_WIDTH,
                    W,
                    PADL,
                    PADR,
                  );
                  const bw = Math.max(1, xNext - x - 1);
                  const bh = (count / histMax) * 35;
                  return (
                    <rect
                      key={`h-${i}`}
                      x={x}
                      y={H - PADB + 50}
                      width={bw}
                      height={bh}
                      fill="#475569"
                      opacity={0.7}
                    />
                  );
                })}
                {stats.samples > 0 && (
                  <text
                    x={PADL}
                    y={H - PADB + 60}
                    fontSize={10}
                    fill="#64748b"
                  >
                    세션 누적 스펙트럼 중심 분포 ({stats.samples} samples)
                  </text>
                )}

                {meanX !== null && (
                  <g>
                    <line
                      x1={meanX}
                      x2={meanX}
                      y1={PADT}
                      y2={H - PADB}
                      stroke="#475569"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                    />
                    <text
                      x={meanX}
                      y={PADT - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#475569"
                      fontWeight={600}
                    >
                      평균 {meanCentroid.toFixed(0)}
                    </text>
                  </g>
                )}

                {centroidX !== null && isFricative && (
                  <g>
                    <line
                      x1={centroidX}
                      x2={centroidX}
                      y1={PADT}
                      y2={H - PADB}
                      stroke="#0f172a"
                      strokeWidth={2.5}
                    />
                    <circle
                      cx={centroidX}
                      cy={(PADT + H - PADB) / 2}
                      r={11}
                      fill="#0f172a"
                      stroke="white"
                      strokeWidth={2.5}
                    />
                    <text
                      x={centroidX}
                      y={H - PADB - 10}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={700}
                      fill="#0f172a"
                    >
                      {centroid !== null ? `${centroid.toFixed(0)} Hz` : ""}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>

          <div
            className={`rounded-2xl border px-5 py-4 text-center text-base font-semibold shadow-sm ${
              feedback.color === "emerald"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : feedback.color === "amber"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : feedback.color === "rose"
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-slate-300 bg-slate-50 text-slate-700"
            }`}
          >
            {feedback.msg}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Box
              label="현재 중심"
              value={
                centroid !== null && isFricative
                  ? `${centroid.toFixed(0)} Hz`
                  : "-"
              }
            />
            <Box
              label="세션 평균"
              value={
                stats.samples > 5
                  ? `${meanCentroid.toFixed(0)} ± ${sdCentroid.toFixed(0)}`
                  : "-"
              }
            />
            <Box
              label="/s/ 체류"
              value={
                stats.samples > 0
                  ? `${((stats.inS / stats.samples) * 100).toFixed(1)} %`
                  : "-"
              }
            />
            <Box
              label="/ʃ/ 체류"
              value={
                stats.samples > 0
                  ? `${((stats.inSh / stats.samples) * 100).toFixed(1)} %`
                  : "-"
              }
            />
          </div>
        </div>

        {/* Anatomical reference for selected target */}
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700">
              목표 조음 위치 — {target.label}
            </h4>
            <div className="min-w-[280px]">
              <AnatomicalDiagram state={target.articulation} showLabels />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div>
              <p className="text-xs font-semibold text-slate-500">설명</p>
              <p className="mt-1 text-sm text-slate-800">{target.description}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-700">유도 방법</p>
              <p className="mt-1 text-sm text-emerald-900">{target.tip}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">참조 구간</p>
              <p className="mt-1 text-sm text-slate-800">
                {target.min}–{target.max} Hz
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-violet-900">{value}</p>
    </div>
  );
}
