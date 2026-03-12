"use client";

import React, { useEffect, useMemo, useState } from "react";
import RecentSpsChart from "./RecentSpsChart";
import CrossModuleComparison from "./CrossModuleComparison";
import SessionSummaryCard from "./SessionSummaryCard";
import PatientRecordManager from "./PatientRecordManager";
import MonthlyReportCard from "./MonthlyReportCard";

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
  maxItems?: number;
};

const STORAGE_KEY = "pd-training-history";

function safeTrim(value?: string) {
  return (value ?? "").trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeClientName(value?: string) {
  return safeTrim(value).toLowerCase().replace(/\s+/g, "");
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
    console.error("TrainingHistory loadAllRecords error:", error);
    return [];
  }
}

function saveAllRecords(records: TrainingRecord[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("pd-training-history-updated"));
  } catch (error) {
    console.error("TrainingHistory saveAllRecords error:", error);
  }
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

function getFeedbackBadgeClass(feedback: string) {
  if (feedback === "빠름") {
    return "bg-red-100 text-red-700 border-red-200";
  }
  if (feedback === "적절") {
    return "bg-green-100 text-green-700 border-green-200";
  }
  if (feedback === "느림") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
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

export default function TrainingHistory({
  moduleType,
  clientName = "",
  title = "최근 기록",
  maxItems = 10,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [allRecords, setAllRecords] = useState<TrainingRecord[]>([]);

  useEffect(() => {
    setMounted(true);
    setAllRecords(loadAllRecords());

    const refresh = () => {
      setAllRecords(loadAllRecords());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("pd-training-history-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("pd-training-history-updated", refresh);
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedName = normalizeClientName(clientName);

    let list = allRecords.filter((item) => item.moduleType === moduleType);

    if (normalizedName) {
      list = list.filter(
        (item) => normalizeClientName(item.clientName) === normalizedName
      );
    }

    return [...list]
      .sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      )
      .slice(0, maxItems);
  }, [allRecords, moduleType, clientName, maxItems]);

  const latestRecord = filteredRecords.length > 0 ? filteredRecords[0] : null;

  const handleDeleteOne = (id: string) => {
    const ok = window.confirm("이 기록 1개를 삭제할까요?");
    if (!ok) return;

    const next = allRecords.filter((item) => item.id !== id);
    setAllRecords(next);
    saveAllRecords(next);
  };

  const handleDeleteModuleRecords = () => {
    const normalizedName = normalizeClientName(clientName);

    const message = normalizedName
      ? `${clientName}님의 ${getModuleLabel(
          moduleType
        )} 훈련 기록을 모두 삭제할까요?`
      : `${getModuleLabel(moduleType)} 훈련 기록을 모두 삭제할까요?`;

    const ok = window.confirm(message);
    if (!ok) return;

    const next = allRecords.filter((item) => {
      const sameModule = item.moduleType === moduleType;
      const sameClient =
        !normalizedName ||
        normalizeClientName(item.clientName) === normalizedName;

      return !(sameModule && sameClient);
    });

    setAllRecords(next);
    saveAllRecords(next);
  };

  const handleDownloadCsv = () => {
    if (filteredRecords.length === 0) {
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

    const rows = filteredRecords.map((item) => [
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
    const namePart = safeTrim(clientName) ? `_${safeTrim(clientName)}` : "";
    a.href = url;
    a.download = `pd_training_${moduleType}${namePart}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!mounted) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-lg font-bold text-slate-800">이번 회기 요약</h3>
          <p className="text-sm text-slate-500">기록을 불러오는 중입니다.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-lg font-bold text-slate-800">치료자용 월간 리포트</h3>
          <p className="text-sm text-slate-500">기록을 불러오는 중입니다.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-lg font-bold text-slate-800">최근 SPS 변화</h3>
          <p className="text-sm text-slate-500">기록을 불러오는 중입니다.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-lg font-bold text-slate-800">같은 사용자 모듈 비교</h3>
          <p className="text-sm text-slate-500">기록을 불러오는 중입니다.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-lg font-bold text-slate-800">환자별 기록 정리</h3>
          <p className="text-sm text-slate-500">기록을 불러오는 중입니다.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">기록을 불러오는 중입니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <SessionSummaryCard record={latestRecord} title="이번 회기 요약" />

      <MonthlyReportCard
        clientName={clientName}
        allRecords={allRecords}
        title="치료자용 월간 리포트"
        days={30}
      />

      <RecentSpsChart
        moduleType={moduleType}
        clientName={clientName}
        title="최근 SPS 변화"
        maxPoints={10}
      />

      <CrossModuleComparison
        clientName={clientName}
        title="같은 사용자 모듈 비교"
      />

      <PatientRecordManager
        clientName={clientName}
        allRecords={allRecords}
        title="환자별 기록 정리"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500">
              {safeTrim(clientName)
                ? `${clientName}님의 ${getModuleLabel(moduleType)} 훈련 기록`
                : `${getModuleLabel(moduleType)} 훈련 기록`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              현재 목록 CSV
            </button>

            <button
              type="button"
              onClick={handleDeleteModuleRecords}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              전체 삭제
            </button>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            아직 저장된 기록이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        최근 {index + 1}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getFeedbackBadgeClass(
                          item.feedback
                        )}`}
                      >
                        {item.feedback}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500">
                      저장일시: {formatDateTime(item.savedAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteOne(item.id)}
                    className="self-start rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    삭제
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">사용자</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {safeTrim(item.clientName) || "-"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">세션 메모</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {safeTrim(item.sessionNote) || "-"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">목표 SPS</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {safeNumber(item.targetSps).toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">측정 SPS</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {safeNumber(item.measuredSps).toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">읽기 단위</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {safeTrim(item.chunkMode) || "-"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">녹음 시간(초)</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.recordingSec !== undefined
                        ? safeNumber(item.recordingSec).toFixed(2)
                        : "-"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3 md:col-span-2 xl:col-span-2">
                    <p className="mb-1 text-xs text-slate-500">연습 문구</p>
                    <p className="line-clamp-3 text-sm font-semibold text-slate-800">
                      {safeTrim(item.practiceText) || "-"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}