"use client";

import React, { useEffect, useMemo, useState } from "react";

type ModuleType = "visual" | "audio" | "mixed";
type FeedbackType = "빠름" | "적절" | "느림" | string;

type TrainingRecord = {
  id: string;
  savedAt: string;
  moduleType: ModuleType;
  clientName?: string;
  sessionNote?: string;
  practiceText: string;
  targetSps: number;
  measuredSps: number;
  feedback: FeedbackType;
  chunkMode?: string;
  recordingSec?: number;
};

type Props = {
  moduleType: ModuleType;
  clientName?: string;
  title?: string;
  maxPoints?: number;
};

type ChartPoint = {
  index: number;
  x: number;
  yMeasured: number;
  yTarget: number;
  measured: number;
  target: number;
  feedback: string;
  label: string;
};

type ChartTick = {
  value: number;
  y: number;
};

type ChartData = {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  innerWidth: number;
  innerHeight: number;
  maxValue: number;
  points: ChartPoint[];
  measuredPath: string;
  targetPath: string;
  yTicks: ChartTick[];
};

const STORAGE_KEY = "pd-training-history";

function safeTrim(value?: string) {
  return (value ?? "").trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function loadAllRecords(): TrainingRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): TrainingRecord | null => {
        if (!item || typeof item !== "object") return null;

        const moduleType = item.moduleType;
        if (
          moduleType !== "visual" &&
          moduleType !== "audio" &&
          moduleType !== "mixed"
        ) {
          return null;
        }

        return {
          id: String(item.id ?? ""),
          savedAt: String(item.savedAt ?? new Date().toISOString()),
          moduleType,
          clientName: String(item.clientName ?? ""),
          sessionNote: String(item.sessionNote ?? ""),
          practiceText: String(item.practiceText ?? ""),
          targetSps: safeNumber(item.targetSps, 0),
          measuredSps: safeNumber(item.measuredSps, 0),
          feedback: String(item.feedback ?? ""),
          chunkMode: String(item.chunkMode ?? ""),
          recordingSec:
            item.recordingSec === undefined
              ? undefined
              : safeNumber(item.recordingSec, 0),
        };
      })
      .filter((item): item is TrainingRecord => item !== null);
  } catch (error) {
    console.error("RecentSpsChart loadAllRecords error:", error);
    return [];
  }
}

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function getModuleColor(moduleType: ModuleType) {
  if (moduleType === "visual") return "#2563eb";
  if (moduleType === "audio") return "#ea580c";
  return "#16a34a";
}

function getFeedbackColor(feedback: string) {
  if (feedback === "빠름") return "#dc2626";
  if (feedback === "적절") return "#16a34a";
  if (feedback === "느림") return "#2563eb";
  return "#64748b";
}

export default function RecentSpsChart({
  moduleType,
  clientName = "",
  title = "최근 SPS 변화",
  maxPoints = 10,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<TrainingRecord[]>([]);

  useEffect(() => {
    setMounted(true);
    setRecords(loadAllRecords());

    const refresh = () => {
      setRecords(loadAllRecords());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("pd-training-history-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("pd-training-history-updated", refresh);
    };
  }, []);

  const filtered = useMemo(() => {
    const trimmedName = safeTrim(clientName).toLowerCase();

    let list = records.filter((item) => item.moduleType === moduleType);

    if (trimmedName) {
      list = list.filter(
        (item) => safeTrim(item.clientName).toLowerCase() === trimmedName
      );
    }

    return [...list]
      .sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime())
      .slice(-maxPoints);
  }, [records, moduleType, clientName, maxPoints]);

  const chartData = useMemo<ChartData | null>(() => {
    if (filtered.length === 0) return null;

    const maxValue = Math.max(
      8,
      ...filtered.map((item) => safeNumber(item.measuredSps, 0)),
      ...filtered.map((item) => safeNumber(item.targetSps, 0))
    );

    const width = 680;
    const height = 260;
    const paddingLeft = 46;
    const paddingRight = 18;
    const paddingTop = 18;
    const paddingBottom = 38;

    const innerWidth = width - paddingLeft - paddingRight;
    const innerHeight = height - paddingTop - paddingBottom;

    const points: ChartPoint[] = filtered.map((item, index) => {
      const x =
        filtered.length === 1
          ? paddingLeft + innerWidth / 2
          : paddingLeft + (innerWidth * index) / (filtered.length - 1);

      const measured = safeNumber(item.measuredSps, 0);
      const target = safeNumber(item.targetSps, 0);

      const yMeasured = paddingTop + innerHeight - (measured / maxValue) * innerHeight;
      const yTarget = paddingTop + innerHeight - (target / maxValue) * innerHeight;

      return {
        index,
        x,
        yMeasured,
        yTarget,
        measured,
        target,
        feedback: item.feedback,
        label: formatShortDate(item.savedAt),
      };
    });

    const measuredPath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.yMeasured}`)
      .join(" ");

    const targetPath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.yTarget}`)
      .join(" ");

    const yTicks: ChartTick[] = [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue].map(
      (value) => ({
        value,
        y: paddingTop + innerHeight - (value / maxValue) * innerHeight,
      })
    );

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      innerWidth,
      innerHeight,
      maxValue,
      points,
      measuredPath,
      targetPath,
      yTicks,
    };
  }, [filtered]);

  const stats = useMemo(() => {
    if (filtered.length === 0) {
      return { avg: 0, best: 0, latest: 0, properRate: 0 };
    }

    const measuredList = filtered.map((item) => safeNumber(item.measuredSps, 0));
    const avg = measuredList.reduce((sum, value) => sum + value, 0) / measuredList.length;
    const best = Math.max(...measuredList);
    const latest = measuredList[measuredList.length - 1];
    const properRate =
      (filtered.filter((item) => item.feedback === "적절").length / filtered.length) * 100;

    return { avg, best, latest, properRate };
  }, [filtered]);

  if (!mounted) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">그래프를 불러오는 중입니다.</p>
      </section>
    );
  }

  if (filtered.length === 0 || chartData === null) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">아직 표시할 기록이 없습니다.</p>
        <p className="mt-1 text-xs text-slate-400">
          저장된 훈련 기록이 생기면 여기에 추세 그래프가 표시됩니다.
        </p>
      </section>
    );
  }

  const moduleColor = getModuleColor(moduleType);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">
            {safeTrim(clientName)
              ? `${clientName}님의 최근 ${filtered.length}회 기록`
              : `최근 ${filtered.length}회 기록`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            평균 {stats.avg.toFixed(2)} SPS
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            최근 {stats.latest.toFixed(2)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            최고 {stats.best.toFixed(2)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            적절 비율 {stats.properRate.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-[3px] w-6 rounded-full"
              style={{ backgroundColor: moduleColor }}
            />
            <span>측정 SPS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-6 rounded-full bg-slate-500" />
            <span>목표 SPS</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            className="min-w-[680px] w-full"
          >
            {chartData.yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={chartData.paddingLeft}
                  y1={tick.y}
                  x2={chartData.width - chartData.paddingRight}
                  y2={tick.y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={chartData.paddingLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                >
                  {tick.value.toFixed(1)}
                </text>
              </g>
            ))}

            <path
              d={chartData.targetPath}
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d={chartData.measuredPath}
              fill="none"
              stroke={moduleColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {chartData.points.map((point) => (
              <g key={`${point.label}-${point.index}`}>
                <circle
                  cx={point.x}
                  cy={point.yMeasured}
                  r="5.5"
                  fill={getFeedbackColor(point.feedback)}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={point.x}
                  y={chartData.height - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {chartData.points.map((point) => (
            <div
              key={`legend-${point.label}-${point.index}`}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {point.index + 1}회
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: getFeedbackColor(point.feedback) }}
                >
                  {point.feedback}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                측정 {point.measured.toFixed(2)} SPS
              </p>
              <p className="text-xs text-slate-500">
                목표 {point.target.toFixed(2)} SPS
              </p>
              <p className="text-xs text-slate-400">{point.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}