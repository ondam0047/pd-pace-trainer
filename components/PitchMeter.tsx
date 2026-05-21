"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { yinPitch } from "./pitch/yin";
import { freqToNoteName, semitonesBetween } from "./pitch/noteUtils";
import SaveToHistory from "./SaveToHistory";

const DURATION_OPTIONS = [15, 30, 45, 60] as const;
type Duration = (typeof DURATION_OPTIONS)[number];

const FFT_SIZES = [2048, 4096] as const;
type FftSize = (typeof FFT_SIZES)[number];

type Preset = { id: string; label: string; lower: number; upper: number };

const PRESETS: Preset[] = [
  { id: "custom", label: "사용자 정의", lower: 0, upper: 0 },
  { id: "male", label: "성인 남성 (85–180 Hz)", lower: 85, upper: 180 },
  { id: "female", label: "성인 여성 (165–255 Hz)", lower: 165, upper: 255 },
  { id: "child", label: "아동 (250–400 Hz)", lower: 250, upper: 400 },
];

const F_MIN = 50;
const F_MAX = 500;
const DB_MIN = 30;
const DB_MAX = 100;
const DB_OFFSET = 80; // dBFS → dB SPL 추정 오프셋 (캘리브레이션 없이)
const CHART_WIDTH = 900;
const PITCH_H = 360;
const INTENSITY_H = 300;
const PADDING = { top: 24, right: 80, bottom: 44, left: 80 };
const GAP_THRESHOLD_SEC = 0.15;

type Sample = { t: number; f0: number | null; db: number | null };

type Scale = { toY: (v: number) => number; toVal: (y: number) => number };

function logScale(min: number, max: number, height: number): Scale {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const innerH = height - PADDING.top - PADDING.bottom;
  return {
    toY: (v) => {
      const c = Math.max(min, Math.min(max, v));
      return (
        PADDING.top + innerH * (1 - (Math.log(c) - logMin) / (logMax - logMin))
      );
    },
    toVal: (y) => {
      const ratio = 1 - (y - PADDING.top) / innerH;
      return Math.exp(logMin + ratio * (logMax - logMin));
    },
  };
}

function linScale(min: number, max: number, height: number): Scale {
  const innerH = height - PADDING.top - PADDING.bottom;
  return {
    toY: (v) => {
      const c = Math.max(min, Math.min(max, v));
      return PADDING.top + innerH * (1 - (c - min) / (max - min));
    },
    toVal: (y) => {
      const ratio = 1 - (y - PADDING.top) / innerH;
      return min + ratio * (max - min);
    },
  };
}

function timeToX(t: number, duration: number): number {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  return PADDING.left + innerWidth * (t / duration);
}

function buildPath(
  samples: Sample[],
  key: "f0" | "db",
  toY: (v: number) => number,
  duration: number,
): string {
  const parts: string[] = [];
  let lastT = -1;
  let lastValid = false;
  for (const s of samples) {
    const v = s[key];
    if (v == null) {
      lastValid = false;
      continue;
    }
    const x = timeToX(s.t, duration);
    const y = toY(v);
    if (!lastValid || s.t - lastT > GAP_THRESHOLD_SEC) {
      parts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
    } else {
      parts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    lastT = s.t;
    lastValid = true;
  }
  return parts.join(" ");
}

export default function PitchMeter() {
  const [duration, setDuration] = useState<Duration>(30);
  const [fftSize, setFftSize] = useState<FftSize>(2048);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [currentF0, setCurrentF0] = useState<number | null>(null);
  const [currentDb, setCurrentDb] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lowerBound, setLowerBound] = useState(150);
  const [upperBound, setUpperBound] = useState(280);
  const [dbLower, setDbLower] = useState(65);
  const [dbUpper, setDbUpper] = useState(80);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    chart: "pitch" | "intensity";
    bound: "low" | "high";
  } | null>(null);
  const [presetId, setPresetId] = useState("custom");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const samplesRef = useRef<Sample[]>([]);
  const durationRef = useRef<Duration>(duration);
  const fftSizeRef = useRef<FftSize>(fftSize);
  const draggingRef = useRef<typeof dragging>(null);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    fftSizeRef.current = fftSize;
  }, [fftSize]);

  const pitchScale = useMemo(() => logScale(F_MIN, F_MAX, PITCH_H), []);
  const dbScale = useMemo(() => linScale(DB_MIN, DB_MAX, INTENSITY_H), []);

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

    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
    const rms = Math.sqrt(sumSq / buf.length);
    const dbSPL = (rms > 0 ? 20 * Math.log10(rms) : -100) + DB_OFFSET;

    const t = (performance.now() - startTimeRef.current) / 1000;
    if (t >= dur) {
      setElapsed(dur);
      stop();
      return;
    }

    const validF0 = f0 > F_MIN && f0 < F_MAX && isFinite(f0);
    const validDb = dbSPL > DB_MIN && dbSPL < DB_MAX;

    if (validF0 || validDb) {
      samplesRef.current.push({
        t,
        f0: validF0 ? f0 : null,
        db: validDb ? dbSPL : null,
      });
      setSamples([...samplesRef.current]);
    }
    setCurrentF0(validF0 ? f0 : null);
    setCurrentDb(validDb ? dbSPL : null);
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
      analyser.fftSize = fftSizeRef.current;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;
      source.connect(analyser);

      samplesRef.current = [];
      setSamples([]);
      setCurrentF0(null);
      setCurrentDb(null);
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
    setCurrentDb(null);
    setElapsed(0);
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const pitchStats = useMemo(() => {
    const voiced = samples.filter((s) => s.f0 != null) as {
      t: number;
      f0: number;
    }[];
    if (voiced.length === 0)
      return { mean: 0, min: 0, max: 0, inRange: 0, total: 0, inRangePct: 0, rangeSemitones: 0 };
    let sum = 0, min = Infinity, max = -Infinity, inRange = 0;
    for (const s of voiced) {
      sum += s.f0;
      if (s.f0 < min) min = s.f0;
      if (s.f0 > max) max = s.f0;
      if (s.f0 >= lowerBound && s.f0 <= upperBound) inRange++;
    }
    return {
      mean: sum / voiced.length,
      min,
      max,
      inRange,
      total: voiced.length,
      inRangePct: (inRange / voiced.length) * 100,
      rangeSemitones: semitonesBetween(min, max),
    };
  }, [samples, lowerBound, upperBound]);

  const dbStats = useMemo(() => {
    const valid = samples.filter((s) => s.db != null) as {
      t: number;
      db: number;
    }[];
    if (valid.length === 0)
      return { mean: 0, min: 0, max: 0, inRange: 0, total: 0, inRangePct: 0 };
    let sum = 0, min = Infinity, max = -Infinity, inRange = 0;
    for (const s of valid) {
      sum += s.db;
      if (s.db < min) min = s.db;
      if (s.db > max) max = s.db;
      if (s.db >= dbLower && s.db <= dbUpper) inRange++;
    }
    return {
      mean: sum / valid.length,
      min,
      max,
      inRange,
      total: valid.length,
      inRangePct: (inRange / valid.length) * 100,
    };
  }, [samples, dbLower, dbUpper]);

  const handleDragValue = useCallback(
    (v: number) => {
      const cur = draggingRef.current;
      if (!cur) return;
      if (cur.chart === "pitch") {
        const f = Math.max(F_MIN + 1, Math.min(F_MAX - 1, v));
        if (cur.bound === "low") setLowerBound(Math.min(f, upperBound - 5));
        else setUpperBound(Math.max(f, lowerBound + 5));
        setPresetId("custom");
      } else {
        const d = Math.max(DB_MIN + 1, Math.min(DB_MAX - 1, v));
        if (cur.bound === "low") setDbLower(Math.min(d, dbUpper - 3));
        else setDbUpper(Math.max(d, dbLower + 3));
      }
    },
    [lowerBound, upperBound, dbLower, dbUpper],
  );

  const endDrag = useCallback(() => setDragging(null), []);

  const handlePresetChange = useCallback((id: string) => {
    setPresetId(id);
    const preset = PRESETS.find((p) => p.id === id);
    if (preset && id !== "custom") {
      setLowerBound(preset.lower);
      setUpperBound(preset.upper);
    }
  }, []);

  const exportCSV = useCallback(() => {
    if (samples.length === 0) return;
    const lines = ["time_sec,f0_hz,in_pitch_range,db_spl,in_db_range"];
    for (const s of samples) {
      const inPitch =
        s.f0 != null && s.f0 >= lowerBound && s.f0 <= upperBound ? 1 : 0;
      const inDb = s.db != null && s.db >= dbLower && s.db <= dbUpper ? 1 : 0;
      lines.push(
        `${s.t.toFixed(3)},${s.f0 != null ? s.f0.toFixed(2) : ""},${inPitch},${s.db != null ? s.db.toFixed(2) : ""},${inDb}`,
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `pitch_intensity_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [samples, lowerBound, upperBound, dbLower, dbUpper]);

  const pitchPath = useMemo(
    () => buildPath(samples, "f0", pitchScale.toY, duration),
    [samples, pitchScale, duration],
  );
  const dbPath = useMemo(
    () => buildPath(samples, "db", dbScale.toY, duration),
    [samples, dbScale, duration],
  );

  const gridTimes = useMemo(() => {
    const step = duration <= 15 ? 3 : duration <= 30 ? 5 : 10;
    const out: number[] = [];
    for (let t = 0; t <= duration; t += step) out.push(t);
    if (out[out.length - 1] !== duration) out.push(duration);
    return out;
  }, [duration]);

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

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            음역대 프리셋
          </span>
          <select
            value={presetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            disabled={isRecording}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">정밀도</span>
          <div
            className="flex overflow-hidden rounded-lg border border-slate-300"
            title="fftSize: 큰 값일수록 저음역까지 정확하지만 화면 갱신이 느려집니다."
          >
            {FFT_SIZES.map((f) => (
              <button
                key={f}
                onClick={() => setFftSize(f)}
                disabled={isRecording}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  f === fftSize
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {f === 2048 ? "기본 (~70Hz↑)" : "저음 (~35Hz↑)"}
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
          <button
            onClick={exportCSV}
            disabled={isRecording || samples.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            CSV 저장
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* 피치 (F0) 트랙 */}
      <TrackChart
        height={PITCH_H}
        duration={duration}
        elapsed={elapsed}
        isRecording={isRecording}
        scale={pitchScale}
        gridValues={[60, 80, 100, 150, 200, 300, 400]}
        gridTimes={gridTimes}
        rightLabel={freqToNoteName}
        unit="Hz"
        yAxisLabel="주파수 (Hz)"
        pathData={pitchPath}
        lineColor="#2563eb"
        currentValue={isRecording ? currentF0 : null}
        lower={lowerBound}
        upper={upperBound}
        bandColor="#dcfce7"
        activeBound={dragging?.chart === "pitch" ? dragging.bound : null}
        onDragStart={(bound) => setDragging({ chart: "pitch", bound })}
        onDragValue={handleDragValue}
        onDragEnd={endDrag}
        caption="상한·하한 막대를 끌어 목표 음역대를 설정하세요. 녹색 영역이 목표 범위입니다."
      />

      {/* 강도 (dB) 트랙 — 같은 녹음·같은 시간축 */}
      <TrackChart
        height={INTENSITY_H}
        duration={duration}
        elapsed={elapsed}
        isRecording={isRecording}
        scale={dbScale}
        gridValues={[40, 50, 60, 70, 80, 90]}
        gridTimes={gridTimes}
        unit="dB"
        yAxisLabel="강도 (dB SPL 추정)"
        pathData={dbPath}
        lineColor="#e11d48"
        currentValue={isRecording ? currentDb : null}
        lower={dbLower}
        upper={dbUpper}
        bandColor="#dcfce7"
        activeBound={dragging?.chart === "intensity" ? dragging.bound : null}
        onDragStart={(bound) => setDragging({ chart: "intensity", bound })}
        onDragValue={handleDragValue}
        onDragEnd={endDrag}
        caption={`상한·하한 막대를 끌어 목표 강도 구간을 설정하세요 (LSVT LOUD 권장 70–85 dB). RMS→dBFS+${DB_OFFSET} 추정값으로 절대값보다 상대 변화 추적에 적합.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          label="현재 F0"
          value={currentF0 ? `${currentF0.toFixed(1)} Hz` : "-"}
          sub={currentF0 ? freqToNoteName(currentF0) : ""}
          accent="blue"
        />
        <StatBox
          label="평균 F0"
          value={pitchStats.total ? `${pitchStats.mean.toFixed(1)} Hz` : "-"}
          sub={pitchStats.total ? freqToNoteName(pitchStats.mean) : ""}
          accent="slate"
        />
        <StatBox
          label="음역 (min ~ max)"
          value={
            pitchStats.total
              ? `${pitchStats.min.toFixed(0)} ~ ${pitchStats.max.toFixed(0)} Hz`
              : "-"
          }
          sub={
            pitchStats.total
              ? `${pitchStats.rangeSemitones.toFixed(1)} semitone`
              : ""
          }
          accent="violet"
        />
        <StatBox
          label="목표 음역대 체류"
          value={pitchStats.total ? `${pitchStats.inRangePct.toFixed(1)} %` : "-"}
          sub={
            pitchStats.total
              ? `${pitchStats.inRange} / ${pitchStats.total} 샘플`
              : ""
          }
          accent="emerald"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          label="현재 강도"
          value={currentDb ? `${currentDb.toFixed(1)} dB` : "-"}
          accent="rose"
        />
        <StatBox
          label="평균 강도"
          value={dbStats.total ? `${dbStats.mean.toFixed(1)} dB` : "-"}
          accent="slate"
        />
        <StatBox
          label="강도 범위"
          value={
            dbStats.total
              ? `${dbStats.min.toFixed(0)} ~ ${dbStats.max.toFixed(0)} dB`
              : "-"
          }
          accent="violet"
        />
        <StatBox
          label="목표 강도 체류"
          value={dbStats.total ? `${dbStats.inRangePct.toFixed(1)} %` : "-"}
          sub={
            dbStats.total ? `${dbStats.inRange} / ${dbStats.total} 샘플` : ""
          }
          accent="emerald"
        />
      </div>

      {isRecording && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          녹음 중 · 경과 {elapsed.toFixed(1)} / {duration}초
        </div>
      )}

      {!isRecording && samples.length > 0 && (
        <SaveToHistory
          moduleId="pitch"
          summary={{
            "평균F0(Hz)": +pitchStats.mean.toFixed(1),
            "최소F0(Hz)": +pitchStats.min.toFixed(1),
            "최대F0(Hz)": +pitchStats.max.toFixed(1),
            "음역(semitone)": +pitchStats.rangeSemitones.toFixed(1),
            "음역체류(%)": +pitchStats.inRangePct.toFixed(1),
            "음역하한": lowerBound,
            "음역상한": upperBound,
            "평균강도(dB)": +dbStats.mean.toFixed(1),
            "최소강도(dB)": +dbStats.min.toFixed(1),
            "최대강도(dB)": +dbStats.max.toFixed(1),
            "강도체류(%)": +dbStats.inRangePct.toFixed(1),
            "강도하한": dbLower,
            "강도상한": dbUpper,
            "녹음시간(초)": duration,
          }}
        />
      )}
    </div>
  );
}

function TrackChart({
  height,
  duration,
  elapsed,
  isRecording,
  scale,
  gridValues,
  gridTimes,
  rightLabel,
  unit,
  yAxisLabel,
  pathData,
  lineColor,
  currentValue,
  lower,
  upper,
  bandColor,
  activeBound,
  onDragStart,
  onDragValue,
  onDragEnd,
  caption,
}: {
  height: number;
  duration: number;
  elapsed: number;
  isRecording: boolean;
  scale: Scale;
  gridValues: number[];
  gridTimes: number[];
  rightLabel?: (v: number) => string;
  unit: string;
  yAxisLabel: string;
  pathData: string;
  lineColor: string;
  currentValue: number | null;
  lower: number;
  upper: number;
  bandColor: string;
  activeBound: "low" | "high" | null;
  onDragStart: (bound: "low" | "high") => void;
  onDragValue: (v: number) => void;
  onDragEnd: () => void;
  caption: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const moveFromClientY = useCallback(
    (clientY: number) => {
      if (!activeBound || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleY = height / rect.height;
      const localY = (clientY - rect.top) * scaleY;
      onDragValue(scale.toVal(localY));
    },
    [activeBound, height, scale, onDragValue],
  );

  const lowerY = scale.toY(lower);
  const upperY = scale.toY(upper);
  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-[640px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          className="w-full touch-none select-none"
          onMouseMove={(e) => moveFromClientY(e.clientY)}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchMove={(e) => {
            if (!activeBound) return;
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) moveFromClientY(touch.clientY);
          }}
          onTouchEnd={onDragEnd}
          onTouchCancel={onDragEnd}
        >
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={innerW}
            height={height - PADDING.top - PADDING.bottom}
            fill="#f8fafc"
          />

          <rect
            x={PADDING.left}
            y={upperY}
            width={innerW}
            height={Math.max(0, lowerY - upperY)}
            fill={bandColor}
            opacity={0.55}
          />

          {gridValues.map((v) => {
            const y = scale.toY(v);
            return (
              <g key={`hv-${v}`}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={PADDING.left - 10}
                  y={y + 5}
                  textAnchor="end"
                  fontSize={14}
                  fill="#475569"
                  fontWeight={500}
                >
                  {v}
                </text>
                {rightLabel && (
                  <text
                    x={CHART_WIDTH - PADDING.right + 10}
                    y={y + 5}
                    textAnchor="start"
                    fontSize={13}
                    fill="#64748b"
                  >
                    {rightLabel(v)}
                  </text>
                )}
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
                  y2={height - PADDING.bottom}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={x}
                  y={height - PADDING.bottom + 18}
                  textAnchor="middle"
                  fontSize={14}
                  fill="#475569"
                  fontWeight={500}
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
            y2={height - PADDING.bottom}
            stroke="#cbd5e1"
          />
          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={height - PADDING.bottom}
            y2={height - PADDING.bottom}
            stroke="#cbd5e1"
          />

          <text
            x={24}
            y={height / 2}
            textAnchor="middle"
            fontSize={14}
            fill="#334155"
            fontWeight={500}
            transform={`rotate(-90 24 ${height / 2})`}
          >
            {yAxisLabel}
          </text>
          <text
            x={CHART_WIDTH / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize={14}
            fill="#334155"
            fontWeight={500}
          >
            시간 (초)
          </text>

          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke={lineColor}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {isRecording && (
            <line
              x1={timeToX(elapsed, duration)}
              x2={timeToX(elapsed, duration)}
              y1={PADDING.top}
              y2={height - PADDING.bottom}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          )}

          {currentValue !== null && isRecording && (
            <circle
              cx={timeToX(elapsed, duration)}
              cy={scale.toY(currentValue)}
              r={6}
              fill={lineColor}
              stroke="white"
              strokeWidth={2}
            />
          )}

          <Handle
            label="상한"
            y={upperY}
            value={upper}
            unit={unit}
            color="#dc2626"
            onStart={() => onDragStart("high")}
          />
          <Handle
            label="하한"
            y={lowerY}
            value={lower}
            unit={unit}
            color="#059669"
            onStart={() => onDragStart("low")}
          />
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

function Handle({
  label,
  y,
  value,
  unit,
  color,
  onStart,
}: {
  label: string;
  y: number;
  value: number;
  unit: string;
  color: string;
  onStart: () => void;
}) {
  return (
    <g
      style={{ cursor: "ns-resize" }}
      onMouseDown={(e) => {
        e.preventDefault();
        onStart();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <line
        x1={PADDING.left}
        x2={CHART_WIDTH - PADDING.right}
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth={2.5}
      />
      <rect x={PADDING.left - 64} y={y - 13} width={56} height={26} fill={color} rx={5} />
      <text
        x={PADDING.left - 36}
        y={y + 5}
        textAnchor="middle"
        fontSize={13}
        fill="white"
        fontWeight={700}
      >
        {label}
      </text>
      <rect
        x={CHART_WIDTH - PADDING.right + 6}
        y={y - 13}
        width={68}
        height={26}
        fill={color}
        rx={5}
      />
      <text
        x={CHART_WIDTH - PADDING.right + 40}
        y={y + 5}
        textAnchor="middle"
        fontSize={13}
        fill="white"
        fontWeight={700}
      >
        {value.toFixed(0)} {unit}
      </text>
    </g>
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
  sub?: string;
  accent: "blue" | "slate" | "violet" | "emerald" | "rose";
}) {
  const colors: Record<typeof accent, string> = {
    blue: "border-blue-200 bg-blue-50",
    slate: "border-slate-200 bg-slate-50",
    violet: "border-violet-200 bg-violet-50",
    emerald: "border-emerald-200 bg-emerald-50",
    rose: "border-rose-200 bg-rose-50",
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
