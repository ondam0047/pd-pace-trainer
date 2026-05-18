"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeSibilantSpectrum } from "./vocalTract/spectralMoments";

// 아동 대상 경험치 발취값 (Jongman et al. 2000 + Kong & Edwards 2016 조정)
// 성인 일반적인 값보다 엽은 높고 넓게 설정
const TARGET_S = { min: 5500, max: 8500, label: "/s/ 치조마찰음", color: "#059669" };
const TARGET_SH = { min: 2800, max: 4500, label: "/ʃ/ 경구개마찰음", color: "#d97706" };

const GAUGE_MIN = 2000;
const GAUGE_MAX = 9500;
const EMA_ALPHA = 0.55;

type Stats = {
  samples: number;
  inS: number;
  inSh: number;
  centroidSum: number;
  centroidSqSum: number;
};

function freqToX(f: number, w: number, padL: number, padR: number): number {
  const inner = w - padL - padR;
  const ratio =
    (Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, f)) - GAUGE_MIN) /
    (GAUGE_MAX - GAUGE_MIN);
  return padL + inner * ratio;
}

export default function SibilantTrainer() {
  const [isRecording, setIsRecording] = useState(false);
  const [centroid, setCentroid] = useState<number | null>(null);
  const [isFricative, setIsFricative] = useState(false);
  const [stats, setStats] = useState<Stats>({
    samples: 0,
    inS: 0,
    inSh: 0,
    centroidSum: 0,
    centroidSqSum: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [target, setTarget] = useState<"s" | "sh">("s");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef<number | null>(null);
  const statsRef = useRef<Stats>({
    samples: 0,
    inS: 0,
    inSh: 0,
    centroidSum: 0,
    centroidSqSum: 0,
  });

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
      if (sm >= TARGET_S.min && sm <= TARGET_S.max) s.inS += 1;
      else if (sm >= TARGET_SH.min && sm <= TARGET_SH.max) s.inSh += 1;
      setStats({ ...s });
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
      statsRef.current = {
        samples: 0,
        inS: 0,
        inSh: 0,
        centroidSum: 0,
        centroidSqSum: 0,
      };
      setStats({
        samples: 0,
        inS: 0,
        inSh: 0,
        centroidSum: 0,
        centroidSqSum: 0,
      });
      setIsRecording(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근에 실패했습니다.");
    }
  }, [tick]);

  useEffect(() => () => stop(), [stop]);

  const meanCentroid = stats.samples > 0 ? stats.centroidSum / stats.samples : 0;
  const sdCentroid =
    stats.samples > 1
      ? Math.sqrt(
          Math.max(
            0,
            stats.centroidSqSum / stats.samples - meanCentroid * meanCentroid,
          ),
        )
      : 0;

  const targetInfo = target === "s" ? TARGET_S : TARGET_SH;
  const currentZone = useMemo(() => {
    if (centroid === null || !isFricative) return null;
    if (centroid >= TARGET_S.min && centroid <= TARGET_S.max) return "s";
    if (centroid >= TARGET_SH.min && centroid <= TARGET_SH.max) return "sh";
    return null;
  }, [centroid, isFricative]);

  const feedback = useMemo(() => {
    if (!isFricative || centroid === null) {
      return { msg: "마찰음을 길게 내세요 (예: 쓬……)", color: "slate" };
    }
    if (currentZone === target) {
      return { msg: `✨ 정확한 ${targetInfo.label}!`, color: "emerald" };
    }
    if (currentZone === null) {
      return {
        msg: `중간 구간입니다 — 혁 위치를 조정해 보세요`,
        color: "amber",
      };
    }
    return {
      msg: `다른 마찰음 구간(${currentZone === "s" ? TARGET_S.label : TARGET_SH.label})에 있습니다`,
      color: "rose",
    };
  }, [isFricative, centroid, currentZone, target, targetInfo]);

  const W = 760;
  const H = 200;
  const PADL = 40;
  const PADR = 40;
  const PADT = 30;
  const PADB = 50;
  const sXmin = freqToX(TARGET_S.min, W, PADL, PADR);
  const sXmax = freqToX(TARGET_S.max, W, PADL, PADR);
  const shXmin = freqToX(TARGET_SH.min, W, PADL, PADR);
  const shXmax = freqToX(TARGET_SH.max, W, PADL, PADR);
  const centroidX =
    centroid !== null ? freqToX(centroid, W, PADL, PADR) : null;
  const meanX =
    stats.samples > 5 ? freqToX(meanCentroid, W, PADL, PADR) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">
          마찰음 훈련 모드 — /s/ vs /ʃ/
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          마찰음의 스펙트럼 중심을 실시간으로 계산해 치조/s/ 구간인지
          경구개/ʃ/ 구간인지 구별합니다. 근거: Jongman, Wayland & Wong (2000),
          Kong & Edwards (2016). · 음소 수준에서 가장 안정적이며,
          단어/문장은 마찰음 부분만 추출될 때 적용 가능합니다 (forced
          alignment 필요).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">목표 음소</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            <button
              onClick={() => setTarget("s")}
              className={`px-4 py-1.5 text-sm font-medium ${target === "s" ? "bg-emerald-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              /s/
            </button>
            <button
              onClick={() => setTarget("sh")}
              className={`px-4 py-1.5 text-sm font-medium ${target === "sh" ? "bg-amber-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              /ʃ/
            </button>
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
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

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
            {/* /sh/ zone */}
            <rect
              x={shXmin}
              y={PADT}
              width={shXmax - shXmin}
              height={H - PADT - PADB}
              fill={TARGET_SH.color}
              opacity={0.18}
            />
            {/* /s/ zone */}
            <rect
              x={sXmin}
              y={PADT}
              width={sXmax - sXmin}
              height={H - PADT - PADB}
              fill={TARGET_S.color}
              opacity={0.18}
            />
            <text
              x={(shXmin + shXmax) / 2}
              y={PADT + 18}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill={TARGET_SH.color}
            >
              /ʃ/
            </text>
            <text
              x={(sXmin + sXmax) / 2}
              y={PADT + 18}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill={TARGET_S.color}
            >
              /s/
            </text>

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
              y={H - 8}
              textAnchor="middle"
              fontSize={12}
              fill="#475569"
            >
              스펙트럼 중심 (Hz)
            </text>

            {/* mean indicator (session average) */}
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

            {/* current indicator */}
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
                  r={10}
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
            stats.samples > 5 ? `${meanCentroid.toFixed(0)} ± ${sdCentroid.toFixed(0)}` : "-"
          }
        />
        <Box
          label="/s/ 구간 체류"
          value={
            stats.samples > 0
              ? `${((stats.inS / stats.samples) * 100).toFixed(1)} %`
              : "-"
          }
        />
        <Box
          label="/ʃ/ 구간 체류"
          value={
            stats.samples > 0
              ? `${((stats.inSh / stats.samples) * 100).toFixed(1)} %`
              : "-"
          }
        />
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
