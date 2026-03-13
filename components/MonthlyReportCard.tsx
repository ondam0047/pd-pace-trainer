"use client";

import React, { useMemo } from "react";

type ModuleType = "visual" | "audio" | "mixed";
type FeedbackType = "빠름" | "적절" | "느림" | string;

export type MonthlyTrainingRecord = {
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
  allRecords: MonthlyTrainingRecord[];
  title?: string;
  days?: number;
};

type ModuleStat = {
  moduleType: ModuleType;
  count: number;
  avgMeasured: number;
  avgTarget: number;
  properRate: number;
  distance: number;
};

type MonthlyReportData = {
  totalCount: number;
  periodText: string;
  avgMeasured: number;
  avgTarget: number;
  properRate: number;
  first3Avg: number;
  last3Avg: number;
  trendDiff: number;
  statsByModule: ModuleStat[];
  summaryText1: string;
  summaryText2: string;
  summaryText3: string;
  summaryText4: string;
};

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

function formatDate(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getModuleLabel(moduleType: ModuleType) {
  if (moduleType === "visual") return "시각";
  if (moduleType === "audio") return "청각";
  return "시각+청각";
}

function calcAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTrendText(diff: number) {
  if (Math.abs(diff) < 0.05) {
    return "초기 회기와 최근 회기 간 평균 SPS 변화가 크지 않았습니다.";
  }
  if (diff > 0) {
    return `최근 회기 평균 SPS가 초기 회기보다 ${diff.toFixed(2)} 높았습니다.`;
  }
  return `최근 회기 평균 SPS가 초기 회기보다 ${Math.abs(diff).toFixed(2)} 낮았습니다.`;
}

function getClosestModuleText(statsByModule: ModuleStat[]) {
  const candidates = statsByModule.filter((item) => item.count > 0);
  if (candidates.length === 0) {
    return "아직 비교할 모듈 기록이 부족합니다.";
  }

  const closest = [...candidates].sort((a, b) => a.distance - b.distance)[0];
  return `목표 SPS에 가장 근접한 모듈은 ${getModuleLabel(
    closest.moduleType
  )} 조건이었습니다.`;
}

function getStableModuleText(statsByModule: ModuleStat[]) {
  const candidates = statsByModule.filter((item) => item.count > 0);
  if (candidates.length === 0) {
    return "아직 안정성을 비교할 충분한 기록이 없습니다.";
  }

  const best = [...candidates].sort((a, b) => {
    if (b.properRate !== a.properRate) return b.properRate - a.properRate;
    return a.distance - b.distance;
  })[0];

  return `적절 비율 기준으로는 ${getModuleLabel(
    best.moduleType
  )} 조건이 가장 안정적인 수행을 보였습니다.`;
}

export default function MonthlyReportCard({
  clientName = "",
  allRecords,
  title = "치료자용 월간 리포트",
  days = 30,
}: Props) {
  const trimmedName = safeTrim(clientName);
  const normalizedName = normalizeClientName(clientName);

  const report = useMemo<MonthlyReportData | null>(() => {
    if (!normalizedName) return null;

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);

    const filtered = allRecords
      .filter((item) => normalizeClientName(item.clientName) === normalizedName)
      .filter((item) => {
        const saved = new Date(item.savedAt);
        return !Number.isNaN(saved.getTime()) && saved >= startDate && saved <= now;
      })
      .sort(
        (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
      );

    const totalCount = filtered.length;
    if (totalCount === 0) return null;

    const measuredList = filtered.map((item) => safeNumber(item.measuredSps, 0));
    const targetList = filtered.map((item) => safeNumber(item.targetSps, 0));

    const avgMeasured = calcAverage(measuredList);
    const avgTarget = calcAverage(targetList);
    const properRate =
      (filtered.filter((item) => item.feedback === "적절").length / totalCount) * 100;

    const first3 = filtered.slice(0, 3);
    const last3 = filtered.slice(-3);

    const first3Avg = calcAverage(
      first3.map((item) => safeNumber(item.measuredSps, 0))
    );
    const last3Avg = calcAverage(
      last3.map((item) => safeNumber(item.measuredSps, 0))
    );
    const trendDiff = last3Avg - first3Avg;

    const modules: ModuleType[] = ["visual", "audio", "mixed"];
    const statsByModule: ModuleStat[] = modules.map((moduleType) => {
      const items = filtered.filter((item) => item.moduleType === moduleType);
      const count = items.length;
      const avgMeasuredModule = calcAverage(
        items.map((item) => safeNumber(item.measuredSps, 0))
      );
      const avgTargetModule = calcAverage(
        items.map((item) => safeNumber(item.targetSps, 0))
      );
      const properRateModule =
        count > 0
          ? (items.filter((item) => item.feedback === "적절").length / count) * 100
          : 0;

      return {
        moduleType,
        count,
        avgMeasured: avgMeasuredModule,
        avgTarget: avgTargetModule,
        properRate: properRateModule,
        distance: Math.abs(avgMeasuredModule - avgTargetModule),
      };
    });

    return {
      totalCount,
      periodText: `${formatDate(startDate)} ~ ${formatDate(now)}`,
      avgMeasured,
      avgTarget,
      properRate,
      first3Avg,
      last3Avg,
      trendDiff,
      statsByModule,
      summaryText1: `${days}일 동안 총 ${totalCount}회의 훈련이 저장되었습니다. 전체 평균 SPS는 ${avgMeasured.toFixed(
        2
      )}, 적절 비율은 ${properRate.toFixed(0)}%였습니다.`,
      summaryText2: getTrendText(trendDiff),
      summaryText3: getClosestModuleText(statsByModule),
      summaryText4: getStableModuleText(statsByModule),
    };
  }, [allRecords, normalizedName, days]);

  if (!trimmedName) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">
          사용자 이름/ID를 입력하면 최근 30일 기준 월간 리포트가 생성됩니다.
        </p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">
          {trimmedName}님의 최근 {days}일 기록이 아직 없습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">
            사용자: {trimmedName} / 기간: {report.periodText}
          </p>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
          최근 {days}일 기준
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">전체 회기 수</p>
          <p className="text-sm font-semibold text-slate-800">
            {report.totalCount}회
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">전체 평균 SPS</p>
          <p className="text-sm font-semibold text-slate-800">
            {report.avgMeasured.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">평균 목표 SPS</p>
          <p className="text-sm font-semibold text-slate-800">
            {report.avgTarget.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">적절 비율</p>
          <p className="text-sm font-semibold text-slate-800">
            {report.properRate.toFixed(0)}%
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">초기 vs 최근 변화</p>
          <p className="text-sm font-semibold text-slate-800">
            {report.trendDiff >= 0 ? "+" : ""}
            {report.trendDiff.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {report.statsByModule.map((item) => (
          <div
            key={item.moduleType}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                {getModuleLabel(item.moduleType)}
              </span>
              <span className="text-xs text-slate-600">{item.count}회</span>
            </div>

            {item.count === 0 ? (
              <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                최근 30일 기록이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3">
                  <p className="mb-1 text-xs text-slate-500">평균 SPS</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.avgMeasured.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="mb-1 text-xs text-slate-500">평균 목표</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.avgTarget.toFixed(2)}
                  </p>
                </div>

                <div className="col-span-2 rounded-xl bg-white p-3">
                  <p className="mb-1 text-xs text-slate-500">적절 비율</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.properRate.toFixed(0)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">종합 요약</p>
          <p className="text-sm leading-6 text-slate-700">{report.summaryText1}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">변화 해석</p>
          <p className="text-sm leading-6 text-slate-700">{report.summaryText2}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            초기 3회 평균 SPS: {report.first3Avg.toFixed(2)} / 최근 3회 평균 SPS:{" "}
            {report.last3Avg.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">모듈 해석</p>
          <p className="text-sm leading-6 text-slate-700">{report.summaryText3}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {report.summaryText4}
          </p>
        </div>
      </div>
    </section>
  );
}