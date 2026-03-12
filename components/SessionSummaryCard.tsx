"use client";

import React, { useMemo } from "react";

type ModuleType = "visual" | "audio" | "mixed";
type FeedbackType = "빠름" | "적절" | "느림" | string;

export type SummaryTrainingRecord = {
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
  record: SummaryTrainingRecord | null;
  title?: string;
};

function safeTrim(value?: string) {
  return (value ?? "").trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getModuleLabel(moduleType: ModuleType) {
  if (moduleType === "visual") return "시각 단서 훈련";
  if (moduleType === "audio") return "청각 단서 훈련";
  return "시각+청각 혼합 훈련";
}

function getFeedbackBadgeClass(feedback: string) {
  if (feedback === "빠름") return "bg-red-100 text-red-700 border-red-200";
  if (feedback === "적절") return "bg-green-100 text-green-700 border-green-200";
  if (feedback === "느림") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
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

function getDiffText(diff: number) {
  if (Math.abs(diff) < 0.05) return "목표 SPS와 거의 일치합니다.";
  if (diff > 0) return `목표보다 ${diff.toFixed(2)} SPS 빠르게 측정되었습니다.`;
  return `목표보다 ${Math.abs(diff).toFixed(2)} SPS 느리게 측정되었습니다.`;
}

function getClinicalComment(feedback: string, diff: number, recordingSec: number) {
  const durationText =
    recordingSec > 0
      ? `실제 녹음 시간은 ${recordingSec.toFixed(2)}초였습니다.`
      : "실제 녹음 시간 정보는 제한적으로 기록되었습니다.";

  if (feedback === "적절") {
    return `이번 회기에서는 목표 속도 범위에 비교적 안정적으로 도달했습니다. ${durationText} 다음 회기에서는 동일 조건을 유지하거나 문장 길이를 약간 늘려 일반화를 확인할 수 있습니다.`;
  }

  if (feedback === "빠름") {
    return `이번 회기에서는 목표보다 빠른 말속도가 관찰되었습니다. ${durationText} 다음 회기에서는 구 끝 pause를 조금 늘리거나 읽기 단위를 더 작게 나누어 속도 조절을 유도하는 것이 도움이 될 수 있습니다.`;
  }

  if (feedback === "느림") {
    return `이번 회기에서는 목표보다 느린 말속도가 관찰되었습니다. ${durationText} 다음 회기에서는 동일 조건에서 반복 연습을 하거나 익숙한 문장으로 수행 안정성을 먼저 높이는 방법을 고려할 수 있습니다.`;
  }

  return `이번 회기 결과를 바탕으로 다음 회기 목표를 조정할 수 있습니다. ${getDiffText(diff)}`;
}

export default function SessionSummaryCard({
  record,
  title = "이번 회기 요약",
}: Props) {
  const summary = useMemo(() => {
    if (!record) return null;

    const targetSps = safeNumber(record.targetSps, 0);
    const measuredSps = safeNumber(record.measuredSps, 0);
    const recordingSec = safeNumber(record.recordingSec, 0);
    const diff = measuredSps - targetSps;

    return {
      clientName: safeTrim(record.clientName) || "-",
      moduleLabel: getModuleLabel(record.moduleType),
      savedAt: formatDateTime(record.savedAt),
      sessionNote: safeTrim(record.sessionNote) || "-",
      practiceText: safeTrim(record.practiceText) || "-",
      targetSps,
      measuredSps,
      diff,
      feedback: record.feedback,
      chunkMode: safeTrim(record.chunkMode) || "-",
      recordingSec,
      interpretation: getDiffText(diff),
      clinicalComment: getClinicalComment(record.feedback, diff, recordingSec),
    };
  }, [record]);

  if (!summary) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">
          아직 요약할 회기 결과가 없습니다. 훈련을 저장하면 이번 회기 요약이 여기에 표시됩니다.
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
            가장 최근에 저장된 회기 결과를 기준으로 자동 생성된 요약입니다.
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${getFeedbackBadgeClass(
            summary.feedback
          )}`}
        >
          {summary.feedback}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">사용자</p>
          <p className="text-sm font-semibold text-slate-800">{summary.clientName}</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">훈련 모듈</p>
          <p className="text-sm font-semibold text-slate-800">{summary.moduleLabel}</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">저장 시각</p>
          <p className="text-sm font-semibold text-slate-800">{summary.savedAt}</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">읽기 단위</p>
          <p className="text-sm font-semibold text-slate-800">{summary.chunkMode}</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">목표 SPS</p>
          <p className="text-sm font-semibold text-slate-800">
            {summary.targetSps.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">측정 SPS</p>
          <p className="text-sm font-semibold text-slate-800">
            {summary.measuredSps.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">목표 대비 차이</p>
          <p className="text-sm font-semibold text-slate-800">
            {summary.diff >= 0 ? "+" : ""}
            {summary.diff.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-500">녹음 시간(초)</p>
          <p className="text-sm font-semibold text-slate-800">
            {summary.recordingSec > 0 ? summary.recordingSec.toFixed(2) : "-"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">요약 해석</p>
        <p className="text-sm leading-6 text-slate-700">{summary.interpretation}</p>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">임상 코멘트</p>
        <p className="text-sm leading-6 text-slate-700">{summary.clinicalComment}</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs text-slate-500">세션 메모</p>
          <p className="text-sm leading-6 text-slate-800">{summary.sessionNote}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs text-slate-500">연습 문구</p>
          <p className="text-sm leading-6 text-slate-800">{summary.practiceText}</p>
        </div>
      </div>
    </section>
  );
}