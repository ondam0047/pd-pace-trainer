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
  clientName?: string;
  title?: string;
};

const STORAGE_KEY = "pd-training-history";

function safeTrim(value?: string) {
  return (value ?? "").trim();
}

function normalizeClientName(value?: string) {
  return safeTrim(value).toLowerCase().replace(/\s+/g, "");
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
    console.error("CrossModuleComparison loadAllRecords error:", error);
    return [];
  }
}

function getModuleLabel(moduleType: ModuleType) {
  if (moduleType === "visual") return "시각";
  if (moduleType === "audio") return "청각";
  return "시각+청각";
}

function getModuleColorClass(moduleType: ModuleType) {
  if (moduleType === "visual") return "border-blue-200 bg-blue-50";
  if (moduleType === "audio") return "border-orange-200 bg-orange-50";
  return "border-green-200 bg-green-50";
}

function getModuleBadgeClass(moduleType: ModuleType) {
  if (moduleType === "visual") return "bg-blue-600";
  if (moduleType === "audio") return "bg-orange-600";
  return "bg-green-600";
}

function getFeedbackTextColor(feedback: string) {
  if (feedback === "빠름") return "text-red-700";
  if (feedback === "적절") return "text-green-700";
  if (feedback === "느림") return "text-blue-700";
  return "text-slate-700";
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${mm}-${dd} ${hh}:${min}`;
}

export default function CrossModuleComparison({
  clientName = "",
  title = "같은 사용자 모듈 비교",
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

  const trimmedName = safeTrim(clientName);
  const normalizedName = normalizeClientName(clientName);

  const userRecords = useMemo(() => {
    if (!normalizedName) return [];

    return records.filter(
      (item) => normalizeClientName(item.clientName) === normalizedName
    );
  }, [records, normalizedName]);

  const summary = useMemo(() => {
    if (!normalizedName) return [];

    const modules: ModuleType[] = ["visual", "audio", "mixed"];

    return modules.map((moduleType) => {
      const items = userRecords
        .filter((item) => item.moduleType === moduleType)
        .sort(
          (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );

      const count = items.length;
      const latest = items[0];

      if (count === 0) {
        return {
          moduleType,
          count: 0,
          avgSps: 0,
          latestSps: 0,
          latestFeedback: "-",
          latestDate: "-",
          properRate: 0,
        };
      }

      const avgSps =
        items.reduce((sum, item) => sum + safeNumber(item.measuredSps, 0), 0) /
        count;
      const properRate =
        (items.filter((item) => item.feedback === "적절").length / count) * 100;

      return {
        moduleType,
        count,
        avgSps,
        latestSps: safeNumber(latest?.measuredSps, 0),
        latestFeedback: latest?.feedback ?? "-",
        latestDate: latest?.savedAt ? formatDateTime(latest.savedAt) : "-",
        properRate,
      };
    });
  }, [userRecords, normalizedName]);

  const bestModule = useMemo(() => {
    const candidates = summary.filter((item) => item.count > 0);
    if (candidates.length === 0) return null;

    return [...candidates].sort((a, b) => {
      if (b.properRate !== a.properRate) return b.properRate - a.properRate;
      return b.avgSps - a.avgSps;
    })[0];
  }, [summary]);

  if (!mounted) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">모듈 비교를 불러오는 중입니다.</p>
      </section>
    );
  }

  if (!trimmedName) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">
          사용자 이름/ID를 입력하면 visual, audio, mixed 기록을 비교합니다.
        </p>
      </section>
    );
  }

  const hasAnyRecord = summary.some((item) => item.count > 0);

  if (!hasAnyRecord) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">
          {trimmedName}님의 저장 기록을 찾지 못했습니다.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          현재 입력 이름: {trimmedName} / 일치 기록 수: {userRecords.length}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{trimmedName}님의 모듈별 수행 비교</p>
        </div>

        {bestModule ? (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            현재 가장 안정적인 모듈: {getModuleLabel(bestModule.moduleType)}
          </div>
        ) : null}
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        비교 기준 이름: <span className="font-semibold">{trimmedName}</span>
        <span className="mx-2">|</span>
        전체 일치 기록 수: <span className="font-semibold">{userRecords.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {summary.map((item) => (
          <div
            key={item.moduleType}
            className={`rounded-2xl border p-4 ${getModuleColorClass(item.moduleType)}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${getModuleBadgeClass(
                  item.moduleType
                )}`}
              >
                {getModuleLabel(item.moduleType)}
              </span>
              <span className="text-xs text-slate-600">{item.count}회 기록</span>
            </div>

            {item.count === 0 ? (
              <div className="rounded-xl bg-white/80 p-4 text-sm text-slate-500">
                아직 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/90 p-3">
                    <p className="mb-1 text-xs text-slate-500">최근 SPS</p>
                    <p className="text-sm font-bold text-slate-800">
                      {item.latestSps.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/90 p-3">
                    <p className="mb-1 text-xs text-slate-500">평균 SPS</p>
                    <p className="text-sm font-bold text-slate-800">
                      {item.avgSps.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/90 p-3">
                    <p className="mb-1 text-xs text-slate-500">적절 비율</p>
                    <p className="text-sm font-bold text-slate-800">
                      {item.properRate.toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/90 p-3">
                    <p className="mb-1 text-xs text-slate-500">최근 결과</p>
                    <p className={`text-sm font-bold ${getFeedbackTextColor(item.latestFeedback)}`}>
                      {item.latestFeedback}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-white/90 p-3">
                  <p className="mb-1 text-xs text-slate-500">최근 저장 시각</p>
                  <p className="text-sm font-semibold text-slate-800">{item.latestDate}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}