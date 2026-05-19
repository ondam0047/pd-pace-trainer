"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SaveToHistory from "@/components/SaveToHistory";

const DB_MIN = 30;
const DB_MAX = 100;
const CHART_WIDTH = 900;
const CHART_HEIGHT = 380;
const PADDING = { top: 24, right: 80, bottom: 44, left: 80 };
const DURATION_OPTIONS = [15, 30, 60, 120] as const;
type Duration = (typeof DURATION_OPTIONS)[number];
const DB_OFFSET = 80; // dBFS → dB SPL 추정 오프셋 (캠리브레이션 없이)

type Sample = { t: number; db: number };

function dbToY(db: number): number {
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  const ratio = (clamped - DB_MIN) / (DB_MAX - DB_MIN);
  return PADDING.top + innerHeight * (1 - ratio);
}
function yToDb(y: number): number {
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const ratio = 1 - (y - PADDING.top) / innerHeight;
  return DB_MIN + ratio * (DB_MAX - DB_MIN);
}
function timeToX(t: number, duration: number): number {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  return PADDING.left + innerWidth * (t / duration);
}

export default function IntensityTrainerPage() {
  const [duration, setDuration] = useState<Duration>(30);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [currentDb, setCurrentDb] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lowerBound, setLowerBound] = useState(70);
  const [upperBound, setUpperBound] = useState(80);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState<null | "low" | "high">(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const samplesRef = useRef<Sample[]>([]);
  const durationRef = useRef<Duration>(duration);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { durationRef.current = duration; }, [duration]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => undefined); audioCtxRef.current = null; }
    analyserRef.current = null;
    setIsRecording(false);
  }, []);

  const tick = useCallback(() => {
    const a = analyserRef.current;
    if (!a) return;
    const dur = durationRef.current;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
    const rms = Math.sqrt(sumSq / buf.length);
    const dbFS = rms > 0 ? 20 * Math.log10(rms) : -100;
    const dbSPL = dbFS + DB_OFFSET;
    const t = (performance.now() - startTimeRef.current) / 1000;
    if (t >= dur) {
      setElapsed(dur);
      stop();
      return;
    }
    if (dbSPL > DB_MIN && dbSPL < DB_MAX) {
      samplesRef.current.push({ t, db: dbSPL });
      setSamples([...samplesRef.current]);
      setCurrentDb(dbSPL);
    } else {
      setCurrentDb(null);
    }
    setElapsed(t);
    rafRef.current = requestAnimationFrame(tick);
  }, [stop]);

  const start = useCallback(async () => {
    setErrorMsg(null);
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
      a.smoothingTimeConstant = 0.3;
      analyserRef.current = a;
      src.connect(a);
      samplesRef.current = [];
      setSamples([]);
      setCurrentDb(null);
      setElapsed(0);
      startTimeRef.current = performance.now();
      setIsRecording(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근 실패. 브라우저 권한을 확인해주세요.");
    }
  }, [tick]);

  const reset = useCallback(() => {
    stop();
    samplesRef.current = [];
    setSamples([]);
    setCurrentDb(null);
    setElapsed(0);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  const stats = useMemo(() => {
    if (samples.length === 0) return { mean: 0, min: 0, max: 0, inRange: 0, total: 0, inRangePct: 0 };
    let sum = 0, mn = Infinity, mx = -Infinity, inRange = 0;
    for (const s of samples) {
      sum += s.db;
      if (s.db < mn) mn = s.db;
      if (s.db > mx) mx = s.db;
      if (s.db >= lowerBound && s.db <= upperBound) inRange++;
    }
    return { mean: sum / samples.length, min: mn, max: mx, inRange, total: samples.length, inRangePct: (inRange / samples.length) * 100 };
  }, [samples, lowerBound, upperBound]);

  const updateDragFromClientY = useCallback((clientY: number) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleY = CHART_HEIGHT / rect.height;
    const localY = (clientY - rect.top) * scaleY;
    const db = Math.max(DB_MIN + 1, Math.min(DB_MAX - 1, yToDb(localY)));
    if (dragging === "low") setLowerBound(Math.min(db, upperBound - 3));
    else setUpperBound(Math.max(db, lowerBound + 3));
  }, [dragging, lowerBound, upperBound]);
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => updateDragFromClientY(e.clientY), [updateDragFromClientY]);
  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) updateDragFromClientY(t.clientY);
  }, [dragging, updateDragFromClientY]);
  const endDrag = useCallback(() => setDragging(null), []);

  const pathData = useMemo(() => {
    if (samples.length === 0) return "";
    const parts: string[] = [];
    for (let i = 0; i < samples.length; i++) {
      const x = timeToX(samples[i].t, duration);
      const y = dbToY(samples[i].db);
      parts.push(i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return parts.join(" ");
  }, [samples, duration]);

  const gridDbs = [40, 50, 60, 70, 80, 90];
  const gridTimes = useMemo(() => {
    const step = duration <= 30 ? 5 : duration <= 60 ? 10 : 20;
    const out: number[] = [];
    for (let t = 0; t <= duration; t += step) out.push(t);
    if (out[out.length - 1] !== duration) out.push(duration);
    return out;
  }, [duration]);

  const lowerY = dbToY(lowerBound);
  const upperY = dbToY(upperBound);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-700">🔴 중재 프로그램</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">강도 바이오피드백 훈련</h1>
          <p className="mt-2 max-w-3xl text-slate-600">목표 강도 구간(예: 70–80 dB)에 머문 시간을 시각화합니다. LSVT LOUD 기반 강도 재교육에 활용하세요.</p>
          <p className="mt-1 max-w-3xl text-xs text-amber-700">⚠ 캐리브레이션 톤 없이 RMS → dBFS + {DB_OFFSET} 으로 추정한 값입니다. 절대값보다 상대 변화 추적에 적합.</p>
        </div>
        {errorMsg && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMsg}</div>}

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">측정 시간</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              {DURATION_OPTIONS.map((d) => (
                <button key={d} onClick={() => setDuration(d)} disabled={isRecording} className={`px-3 py-1.5 text-sm font-medium ${d === duration ? "bg-rose-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"} disabled:opacity-50`}>{d}초</button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            {!isRecording ? <button onClick={start} className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700">시작</button> : <button onClick={stop} className="rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">정지</button>}
            <button onClick={reset} disabled={isRecording} className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">초기화</button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-[640px]">
            <svg ref={svgRef} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full touch-none select-none"
              onMouseMove={handleMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}
              onTouchMove={handleTouchMove} onTouchEnd={endDrag} onTouchCancel={endDrag}>
              <rect x={PADDING.left} y={PADDING.top} width={CHART_WIDTH - PADDING.left - PADDING.right} height={CHART_HEIGHT - PADDING.top - PADDING.bottom} fill="#f8fafc" />
              <rect x={PADDING.left} y={upperY} width={CHART_WIDTH - PADDING.left - PADDING.right} height={Math.max(0, lowerY - upperY)} fill="#dcfce7" opacity={0.6} />
              {gridDbs.map((db) => { const y = dbToY(db); return (
                <g key={`hd-${db}`}>
                  <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x={PADDING.left - 10} y={y + 5} textAnchor="end" fontSize={14} fill="#475569" fontWeight={500}>{db}</text>
                </g>
              ); })}
              {gridTimes.map((t) => { const x = timeToX(t, duration); return (
                <g key={`vt-${t}`}>
                  <line x1={x} x2={x} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x={x} y={CHART_HEIGHT - PADDING.bottom + 18} textAnchor="middle" fontSize={14} fill="#475569" fontWeight={500}>{t}s</text>
                </g>
              ); })}
              <line x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} stroke="#cbd5e1" />
              <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={CHART_HEIGHT - PADDING.bottom} y2={CHART_HEIGHT - PADDING.bottom} stroke="#cbd5e1" />
              <text x={24} y={CHART_HEIGHT / 2} textAnchor="middle" fontSize={14} fill="#334155" fontWeight={500} transform={`rotate(-90 24 ${CHART_HEIGHT / 2})`}>강도 (dB SPL 추정)</text>
              <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 6} textAnchor="middle" fontSize={14} fill="#334155" fontWeight={500}>시간 (초)</text>
              {pathData && <path d={pathData} fill="none" stroke="#e11d48" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
              {isRecording && <line x1={timeToX(elapsed, duration)} x2={timeToX(elapsed, duration)} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} stroke="#94a3b8" strokeWidth={1} />}
              {currentDb !== null && isRecording && <circle cx={timeToX(elapsed, duration)} cy={dbToY(currentDb)} r={6} fill="#e11d48" stroke="white" strokeWidth={2} />}
              <g style={{ cursor: "ns-resize" }} onMouseDown={(e) => { e.preventDefault(); setDragging("high"); }} onTouchStart={(e) => { e.preventDefault(); setDragging("high"); }}>
                <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={upperY} y2={upperY} stroke="#dc2626" strokeWidth={2.5} />
                <rect x={PADDING.left - 64} y={upperY - 13} width={56} height={26} fill="#dc2626" rx={5} />
                <text x={PADDING.left - 36} y={upperY + 5} textAnchor="middle" fontSize={13} fill="white" fontWeight={700}>상한</text>
                <rect x={CHART_WIDTH - PADDING.right + 6} y={upperY - 13} width={68} height={26} fill="#dc2626" rx={5} />
                <text x={CHART_WIDTH - PADDING.right + 40} y={upperY + 5} textAnchor="middle" fontSize={13} fill="white" fontWeight={700}>{upperBound.toFixed(0)} dB</text>
              </g>
              <g style={{ cursor: "ns-resize" }} onMouseDown={(e) => { e.preventDefault(); setDragging("low"); }} onTouchStart={(e) => { e.preventDefault(); setDragging("low"); }}>
                <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={lowerY} y2={lowerY} stroke="#059669" strokeWidth={2.5} />
                <rect x={PADDING.left - 64} y={lowerY - 13} width={56} height={26} fill="#059669" rx={5} />
                <text x={PADDING.left - 36} y={lowerY + 5} textAnchor="middle" fontSize={13} fill="white" fontWeight={700}>하한</text>
                <rect x={CHART_WIDTH - PADDING.right + 6} y={lowerY - 13} width={68} height={26} fill="#059669" rx={5} />
                <text x={CHART_WIDTH - PADDING.right + 40} y={lowerY + 5} textAnchor="middle" fontSize={13} fill="white" fontWeight={700}>{lowerBound.toFixed(0)} dB</text>
              </g>
            </svg>
          </div>
          <p className="mt-2 text-xs text-slate-500">상한·하한 막대를 드래그해 목표 강도 구간을 설정하세요. 녹색 영역이 목표입니다.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatBox label="현재 강도" value={currentDb ? `${currentDb.toFixed(1)} dB` : "-"} accent="rose" />
          <StatBox label="평균 강도" value={stats.total ? `${stats.mean.toFixed(1)} dB` : "-"} accent="slate" />
          <StatBox label="강도 범위" value={stats.total ? `${stats.min.toFixed(0)} ~ ${stats.max.toFixed(0)} dB` : "-"} accent="violet" />
          <StatBox label="목표 구간 체류" value={stats.total ? `${stats.inRangePct.toFixed(1)} %` : "-"} sub={stats.total ? `${stats.inRange} / ${stats.total} 샘플` : ""} accent="emerald" />
        </div>

        {isRecording && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">녹음 중 · 경과 {elapsed.toFixed(1)} / {duration}초</div>}

        {!isRecording && stats.total > 0 && (
          <SaveToHistory
            moduleId="intensity_trainer"
            summary={{
              "평균(dB)": +stats.mean.toFixed(1),
              "최소(dB)": +stats.min.toFixed(1),
              "최대(dB)": +stats.max.toFixed(1),
              "목표체류(%)": +stats.inRangePct.toFixed(1),
              "목표하한": lowerBound,
              "목표상한": upperBound,
              "녹음시간(초)": duration,
            }}
          />
        )}

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">목표 구간 참고 + 근거</summary>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
              <div>일반 대화</div><div className="font-semibold tabular-nums">55–65 dB</div>
              <div>또렷한 말 (newscaster)</div><div className="font-semibold tabular-nums">65–75 dB</div>
              <div>LSVT LOUD 목표</div><div className="font-semibold tabular-nums">70–85 dB</div>
              <div>외침</div><div className="font-semibold tabular-nums">85+ dB</div>
            </div>
            <p className="mt-3 text-xs text-slate-500">근거: Ramig 외 (2001) LSVT LOUD / Fox 외 (2012) PD 음성 재교육 임상 가이드라인</p>
          </div>
        </details>
      </div>
    </main>
  );
}

function StatBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: "rose" | "slate" | "violet" | "emerald" }) {
  const colors: Record<typeof accent, string> = {
    rose: "border-rose-200 bg-rose-50",
    slate: "border-slate-200 bg-slate-50",
    violet: "border-violet-200 bg-violet-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };
  return (
    <div className={`rounded-xl border ${colors[accent]} px-4 py-3`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
