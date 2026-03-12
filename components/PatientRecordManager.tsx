"use client";

import React, { useMemo } from "react";

type ModuleType = "visual" | "audio" | "mixed";
type FeedbackType = "빠름" | "적절" | "느림" | string;

export type PatientTrainingRecord = {
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
  allRecords: PatientTrainingRecord[];
  title?: string;
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

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getModuleLabel(moduleType: ModuleType) {
  if (moduleType === "visual") return "시각";
  if (moduleType === "audio") return "청각";
  return "시각+청각";
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function PatientRecordManager({
  clientName = "",
  allRecords,
  title = "환자별 기록 정리",
}: Props) {
  const normalizedName = normalizeClientName(clientName);
  const trimmedName = safeTrim(clientName);

  const patientRecords = useMemo(() => {
    if (!normalizedName) return [];

    return [...allRecords]
      .filter((item) => normalizeClientName(item.clientName) === normalizedName)
      .sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
  }, [allRecords, normalizedName]);

  const grouped = useMemo(() => {
    const visual = patientRecords.filter((item) => item.moduleType === "visual");
    const audio = patientRecords.filter((item) => item.moduleType === "audio");
    const mixed = patientRecords.filter((item) => item.moduleType === "mixed");

    return { visual, audio, mixed };
  }, [patientRecords]);

  const stats = useMemo(() => {
    if (patientRecords.length === 0) {
      return {
        total: 0,
        avgSps: 0,
        properRate: 0,
        latestSavedAt: "-",
      };
    }

    const avgSps =
      patientRecords.reduce(
        (sum, item) => sum + safeNumber(item.measuredSps, 0),
        0
      ) / patientRecords.length;

    const properRate =
      (patientRecords.filter((item) => item.feedback === "적절").length /
        patientRecords.length) *
      100;

    return {
      total: patientRecords.length,
      avgSps,
      properRate,
      latestSavedAt: formatDateTime(patientRecords[0].savedAt),
    };
  }, [patientRecords]);

  const downloadCsv = (
    records: PatientTrainingRecord[],
    filenameSuffix: string
  ) => {
    if (records.length === 0) {
      window.alert("다운로드할 기록이 없습니다.");
      return;
    }

    const headers = [
      "savedAt",
      "moduleType",
      "clientName",
      "sessionNote",
      "practiceText",
      "targetSps",
      "measuredSps",
      "feedback",
      "chunkMode",
      "recordingSec",
    ];

    const rows = records.map((item) => [
      item.savedAt,
      item.moduleType,
      item.clientName ?? "",
      item.sessionNote ?? "",
      item.practiceText ?? "",
      item.targetSps,
      item.measuredSps,
      item.feedback,
      item.chunkMode ?? "",
      item.recordingSec ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = trimmedName || "unknown";
    a.href = url;
    a.download = `pd_patient_${safeName}_${filenameSuffix}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!trimmedName) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">
          사용자 이름/ID를 입력하면 현재 환자의 전체 기록을 모듈별로 정리하고, 사용자 기준 CSV를 내려받을 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">
            현재 사용자: {trimmedName}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(patientRecords, "all_modules")}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            사용자 전체 CSV
          </button>

          <button
            type="button"
            onClick={() => downloadCsv(grouped.visual, "visual")}
            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            시각 CSV
          </button>

          <button
            type="button"
            onClick={() => downloadCsv(grouped.audio, "audio")}
            className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
          >
            청각 CSV
          </button>

          <button
            type="button"
            onClick={() => downloadCsv(grouped.mixed, "mixed")}
            className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            혼합 CSV
          </button>
        </div>
      </div>

      {patientRecords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          현재 사용자 이름으로 저장된 기록이 없습니다.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-1 text-xs text-slate-500">전체 기록 수</p>
              <p className="text-sm font-semibold text-slate-800">{stats.total}회</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-1 text-xs text-slate-500">전체 평균 SPS</p>
              <p className="text-sm font-semibold text-slate-800">
                {stats.avgSps.toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-1 text-xs text-slate-500">적절 비율</p>
              <p className="text-sm font-semibold text-slate-800">
                {stats.properRate.toFixed(0)}%
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-1 text-xs text-slate-500">최근 저장 시각</p>
              <p className="text-sm font-semibold text-slate-800">
                {stats.latestSavedAt}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(["visual", "audio", "mixed"] as ModuleType[]).map((moduleType) => {
              const items = grouped[moduleType];
              const latest = items[0];

              return (
                <div
                  key={moduleType}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      {getModuleLabel(moduleType)}
                    </span>
                    <span className="text-xs text-slate-600">
                      {items.length}회
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                      아직 기록이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-white p-3">
                        <p className="mb-1 text-xs text-slate-500">최근 SPS</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {safeNumber(latest?.measuredSps, 0).toFixed(2)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="mb-1 text-xs text-slate-500">최근 피드백</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {latest?.feedback ?? "-"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="mb-1 text-xs text-slate-500">최근 저장 시각</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {latest?.savedAt ? formatDateTime(latest.savedAt) : "-"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}