"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { yinPitch } from "./pitch/yin";
import { freqToNoteName, semitonesBetween } from "./pitch/noteUtils";

const DURATION_OPTIONS = [15, 30, 45, 60] as const;
type Duration = (typeof DURATION_OPTIONS)[number];

const F_MIN = 50;
const F_MAX = 500;
const CHART_WIDTH = 900;
const CHART_HEIGHT = 380;
const PADDING = { top: 20, right: 70, bottom: 40, left: 70 };
const GAP_THRESHOLD_SEC = 0.15;

type Sample = { t: number; f0: number };

function freqToY(freq: number): number {
  const logMin = Math.log(F_MIN);
  const logMax = Math.log(F_MAX);
  const clamped = Math.max(F_MIN, Math.min(F_MAX, freq));
  const logF = Math.log(clamped);
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  return PADDING.top + innerHeight * (1 - (logF - logMin) / (logMax - logMin));
}

function yToFreq(y: number): number {
  const logMin = Math.log(F_MIN);
  const logMax = Math.log(F_MAX);
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const ratio = 1 - (y - PADDING.top) / innerHeight;
  return Math.exp(logMin + ratio * (logMax - logMin));
}

function timeToX(t: number, duration: number): number {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  return PADDING.left + innerWidth * (t / duration);
}

export default function PitchMeter() {
  const [duration, setDuration] = useState<Duration>(30);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [currentF0, setCurrentF0] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lowerBound, setLowerBound] = useState(150);
  const [upperBound, setUpperBound] = useState(280);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState<null | "low" | "high">(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const samplesRef = useRef<Sample[]>([]);
  const durationRef = useRef<Duration>(duration);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

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
    sourceRef.current = null;
    setIsRecording(false);
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const dur = durationRef.current;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    const f0 = yinPitch(buf, ctx.sampleRate);
    const t = (performance.now() - startTimeRef.current) / 1000;

    if (t >= dur) {
      setElapsed(dur);
      stop();
      return;
    }

    if (f0 > F_MIN && f0 < F_MAX && isFinite(f0)) {
      samplesRef.current.push({ t, f0 });
      setSamples([...samplesRef.current]);
      setCurrentF0(f0);
    } else {
      setCurrentF0(null);
    }
    setElapsed(t);

    rafRef.current = requestAnimationFrame(tick);
  }, [stop]);

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
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;
      source.connect(analyser);

      samplesRef.current = [];
      setSamples([]);
      setCurrentF0(null);
      setElapsed(0);
      startTimeRef.current = performance.now();
      setIsRecording(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "마이크 접근에 실패했습니다. 브라우저에서 마이크 권한을 확인해주세요.",
      );
    }
  }, [tick]);

  const reset = useCallback(() => {
    stop();
    samplesRef.current = [];
    setSamples([]);
    setCurrentF0(null);
    setElapsed(0);
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const stats = useMemo(() => {
    if (samples.length === 0) {
      return {
        mean: 0,
        min: 0,
        max: 0,
        inRange: 0,
        total: 0,
        inRangePct: 0,
        rangeSemitones: 0,
      };
    }
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let inRange = 0;
    for (const s of samples) {
      sum += s.f0;
      if (s.f0 < min) min = s.f0;
      if (s.f0 > max) max = s.f0;
      if (s.f0 >= lowerBound && s.f0 <= upperBound) inRange++;
    }
    return {
      mean: sum / samples.length,
      min,
      max,
      inRange,
      total: samples.length,
      inRangePct: (inRange / samples.length) * 100,
      rangeSemitones: semitonesBetween(min, max),
    };
  }, [samples, lowerBound, upperBound]);

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleY = CHART_HEIGHT / rect.height;
      const localY = (e.clientY - rect.top) * scaleY;
      const freq = Math.max(F_MIN + 1, Math.min(F_MAX - 1, yToFreq(localY)));
      if (dragging === "low") {
        setLowerBound((prev) =>
          Math.min(freq, Math.max(F_MIN + 1, upperBound - 5)) === freq
            ? freq
            : prev,
        );
      } else {
        setUpperBound((prev) =>
          Math.max(freq, Math.min(F_MAX - 1, lowerBound + 5)) === freq
            ? freq
            : prev,
        );
      }
    },
    [dragging, lowerBound, upperBound],
  );

  const handleSvgMouseUp = useCallback(() => setDragging(null), []);

  const pathData = useMemo(() => {
    if (samples.length === 0) return "";
    const parts: string[] = [];
    let lastT = -1;
    for (const s of samples) {
      const x = timeToX(s.t, duration);
      const y = freqToY(s.f0);
      if (lastT < 0 || s.t - lastT > GAP_THRESHOLD_SEC) {
        parts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
      } else {
        parts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      lastT = s.t;
    }
    return parts.join(" ");
  }, [samples, duration]);

  const gridFreqs = [60, 80, 100, 150, 200, 300, 400];
  const gridTimes = useMemo(() => {
    const step = duration <= 15 ? 3 : duration <= 30 ? 5 : 10;
    const out: number[] = [];
    for (let t = 0; t <= duration; t += step) out.push(t);
    if (out[out.length - 1] !== duration) out.push(duration);
    return out;
  }, [duration]);

  const lowerY = freqToY(lowerBound);
  const upperY = freqToY(upperBound);
  const inRangeColor = "#dcfce7";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">측정 시간</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                disabled={isRecording}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  d === duration
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {d}초
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {!isRecording ? (
            <button
              onClick={start}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              시작
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
            disabled={isRecording}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            초기화
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full select-none"
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={CHART_WIDTH - PADDING.left - PADDING.right}
            height={CHART_HEIGHT - PADDING.top - PADDING.bottom}
            fill="#f8fafc"
          />

          <rect
            x={PADDING.left}
            y={upperY}
            width={CHART_WIDTH - PADDING.left - PADDING.right}
            height={Math.max(0, lowerY - upperY)}
            fill={inRangeColor}
            opacity={0.55}
          />

          {gridFreqs.map((f) => {
            const y = freqToY(f);
            return (
              <g key={`hf-${f}`}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                >
                  {f}
                </text>
                <text
                  x={CHART_WIDTH - PADDING.right + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="10"
                  fill="#94a3b8"
                >
                  {freqToNoteName(f)}
                </text>
              </g>
            );
          })}

          {gridTimes.map((t) => {
            const x = timeToX(t, duration);
            return (
              <g key={`vt-${t}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PADDING.top}
                  y2={CHART_HEIGHT - PADDING.bottom}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={x}
                  y={CHART_HEIGHT - PADDING.bottom + 16}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {t}s
                </text>
              </g>
            );
          })}

          <line
            x1={PADDING.left}
            x2={PADDING.left}
            y1={PADDING.top}
            y2={CHART_HEIGHT - PADDING.bottom}
            stroke="#cbd5e1"
          />
          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={CHART_HEIGHT - PADDING.bottom}
            y2={CHART_HEIGHT - PADDING.bottom}
            stroke="#cbd5e1"
          />

          <text
            x={22}
            y={CHART_HEIGHT / 2}
            textAnchor="middle"
            fontSize="11"
            fill="#475569"
            transform={`rotate(-90 22 ${CHART_HEIGHT / 2})`}
          >
            주파수 (Hz)
          </text>
          <text
            x={CHART_WIDTH / 2}
            y={CHART_HEIGHT - 4}
            textAnchor="middle"
            fontSize="11"
            fill="#475569"
          >
            시간 (초)
          </text>

          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {isRecording && (
            <line
              x1={timeToX(elapsed, duration)}
              x2={timeToX(elapsed, duration)}
              y1={PADDING.top}
              y2={CHART_HEIGHT - PADDING.bottom}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          )}

          {currentF0 !== null && isRecording && (
            <circle
              cx={timeToX(elapsed, duration)}
              cy={freqToY(currentF0)}
              r={5}
              fill="#2563eb"
              stroke="white"
              strokeWidth={2}
            />
          )}

          <g
            style={{ cursor: "ns-resize" }}
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging("high");
            }}
          >
            <line
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={upperY}
              y2={upperY}
              stroke="#dc2626"
              strokeWidth={2}
            />
            <rect
              x={PADDING.left - 56}
              y={upperY - 11}
              width={50}
              height={22}
              fill="#dc2626"
              rx={4}
            />
            <text
              x={PADDING.left - 31}
              y={upperY + 4}
              textAnchor="middle"
              fontSize="11"
              fill="white"
              fontWeight={600}
            >
              상한
            </text>
            <rect
              x={CHART_WIDTH - PADDING.right + 4}
              y={upperY - 11}
              width={58}
              height={22}
              fill="#dc2626"
              rx={4}
            />
            <text
              x={CHART_WIDTH - PADDING.right + 33}
              y={upperY + 4}
              textAnchor="middle"
              fontSize="11"
              fill="white"
              fontWeight={600}
            >
              {upperBound.toFixed(0)} Hz
            </text>
          </g>

          <g
            style={{ cursor: "ns-resize" }}
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging("low");
            }}
          >
            <line
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={lowerY}
              y2={lowerY}
              stroke="#059669"
              strokeWidth={2}
            />
            <rect
              x={PADDING.left - 56}
              y={lowerY - 11}
              width={50}
              height={22}
              fill="#059669"
              rx={4}
            />
            <text
              x={PADDING.left - 31}
              y={lowerY + 4}
              textAnchor="middle"
              fontSize="11"
              fill="white"
              fontWeight={600}
            >
              하한
            </text>
            <rect
              x={CHART_WIDTH - PADDING.right + 4}
              y={lowerY - 11}
              width={58}
              height={22}
              fill="#059669"
              rx={4}
            />
            <text
              x={CHART_WIDTH - PADDING.right + 33}
              y={lowerY + 4}
              textAnchor="middle"
              fontSize="11"
              fill="white"
              fontWeight={600}
            >
              {lowerBound.toFixed(0)} Hz
            </text>
          </g>
        </svg>
        <p className="mt-2 text-xs text-slate-500">
          상한·하한 막대를 위/아래로 끌어 목표 음역대를 설정하세요. 녹색 영역이
          목표 범위이며, 음표명은 평균율 12-TET 기준입니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          label="현재 F0"
          value={currentF0 ? `${currentF0.toFixed(1)} Hz` : "-"}
          sub={currentF0 ? freqToNoteName(currentF0) : ""}
          accent="blue"
        />
        <StatBox
          label="평균 F0"
          value={stats.total ? `${stats.mean.toFixed(1)} Hz` : "-"}
          sub={stats.total ? freqToNoteName(stats.mean) : ""}
          accent="slate"
        />
        <StatBox
          label="음역 (min ~ max)"
          value={
            stats.total
              ? `${stats.min.toFixed(0)} ~ ${stats.max.toFixed(0)} Hz`
              : "-"
          }
          sub={
            stats.total ? `${stats.rangeSemitones.toFixed(1)} semitone` : ""
          }
          accent="violet"
        />
        <StatBox
          label="목표 음역대 체류"
          value={stats.total ? `${stats.inRangePct.toFixed(1)} %` : "-"}
          sub={stats.total ? `${stats.inRange} / ${stats.total} 샘플` : ""}
          accent="emerald"
        />
      </div>

      {isRecording && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          녹음 중 · 경과 {elapsed.toFixed(1)} / {duration}초
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "slate" | "violet" | "emerald";
}) {
  const colors: Record<typeof accent, string> = {
    blue: "border-blue-200 bg-blue-50",
    slate: "border-slate-200 bg-slate-50",
    violet: "border-violet-200 bg-violet-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };
  return (
    <div className={`rounded-xl border ${colors[accent]} px-4 py-3`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
