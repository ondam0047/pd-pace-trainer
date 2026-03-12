"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ModuleType,
  TRAINING_HISTORY_UPDATED_EVENT,
  TrainingRecord,
  getTrainingHistoryByModule,
} from "./trainingStorage";

interface TrainingComparisonSummaryProps {
  moduleType: ModuleType;
  title?: string;
  clientName?: string;
}

function getFeedbackStyle(feedback: string): React.CSSProperties {
  if (feedback === "빠름") {
    return {
      background: "#ffe5e5",
      color: "#c62828",
      border: "1px solid #f3b1b1",
    };
  }

  if (feedback === "적절") {
    return {
      background: "#e7f7ea",
      color: "#2e7d32",
      border: "1px solid #b8debd",
    };
  }

  if (feedback === "느림") {
    return {
      background: "#e8f1ff",
      color: "#1565c0",
      border: "1px solid #b8cff5",
    };
  }

  return {
    background: "#f3f3f3",
    color: "#666",
    border: "1px solid #ddd",
  };
}

function getModuleAccent(moduleType: ModuleType) {
  if (moduleType === "visual") {
    return {
      light: "#f4f9ff",
      border: "#d6e8ff",
      strong: "#1f5fae",
    };
  }

  if (moduleType === "audio") {
    return {
      light: "#fff9ef",
      border: "#f7ddb2",
      strong: "#9a6200",
    };
  }

  return {
    light: "#f5fcf7",
    border: "#d6eddc",
    strong: "#2e7d4a",
  };
}

function formatDelta(value: number) {
  const rounded = Number(value.toFixed(2));
  if (rounded > 0) return `+${rounded}`;
  return `${rounded}`;
}

function getDeltaMeaning(
  currentTargetDistance: number,
  previousTargetDistance: number
) {
  if (Math.abs(currentTargetDistance) < Math.abs(previousTargetDistance)) {
    return "직전보다 목표에 더 가까워졌어요.";
  }

  if (Math.abs(currentTargetDistance) > Math.abs(previousTargetDistance)) {
    return "직전보다 목표에서 더 멀어졌어요.";
  }

  return "직전과 비슷한 수준이에요.";
}

interface SummaryData {
  hasData: boolean;
  current: TrainingRecord | null;
  previous: TrainingRecord | null;
  targetDiff: number;
  changeFromPrevious: number | null;
  changeMeaning: string | null;
  avgRecentFive: number;
  adequateRate: number;
  recentCount: number;
}

export default function TrainingComparisonSummary({
  moduleType,
  title,
  clientName,
}: TrainingComparisonSummaryProps) {
  const [records, setRecords] = useState<TrainingRecord[]>([]);

  const normalizedClientName = (clientName ?? "").trim();

  useEffect(() => {
    const refresh = () => {
      const all = getTrainingHistoryByModule(moduleType);
      const filtered = normalizedClientName
        ? all.filter((item) => (item.clientName ?? "").trim() === normalizedClientName)
        : all;

      setRecords(filtered);
    };

    refresh();

    window.addEventListener(TRAINING_HISTORY_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(TRAINING_HISTORY_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [moduleType, normalizedClientName]);

  const accent = getModuleAccent(moduleType);

  const summary: SummaryData = useMemo(() => {
    const current = records[0] ?? null;
    const previous = records[1] ?? null;
    const recentFive = records.slice(0, 5);

    if (!current) {
      return {
        hasData: false,
        current: null,
        previous: null,
        targetDiff: 0,
        changeFromPrevious: null,
        changeMeaning: null,
        avgRecentFive: 0,
        adequateRate: 0,
        recentCount: 0,
      };
    }

    const targetDiff = current.measuredSps - current.targetSps;

    let changeFromPrevious: number | null = null;
    let changeMeaning: string | null = null;

    if (previous) {
      changeFromPrevious = current.measuredSps - previous.measuredSps;

      const currentTargetDistance = current.measuredSps - current.targetSps;
      const previousTargetDistance = previous.measuredSps - previous.targetSps;

      changeMeaning = getDeltaMeaning(
        currentTargetDistance,
        previousTargetDistance
      );
    }

    const avgRecentFive =
      recentFive.reduce((sum, item) => sum + item.measuredSps, 0) /
      recentFive.length;

    const adequateCount = recentFive.filter(
      (item) => item.feedback === "적절"
    ).length;

    const adequateRate = (adequateCount / recentFive.length) * 100;

    return {
      hasData: true,
      current,
      previous,
      targetDiff,
      changeFromPrevious,
      changeMeaning,
      avgRecentFive,
      adequateRate,
      recentCount: recentFive.length,
    };
  }, [records]);

  if (!summary.hasData || !summary.current) {
    return (
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          background: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{title ?? "결과 비교 요약"}</h3>
        <p style={{ margin: 0, color: "#666" }}>
          {normalizedClientName
            ? `${normalizedClientName} 사용자 기준으로 아직 비교할 훈련 기록이 없습니다.`
            : "아직 비교할 훈련 기록이 없습니다."}
        </p>
      </section>
    );
  }

  const current = summary.current;
  const previous = summary.previous;

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        background: "#fff",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>
        {title ?? "결과 비교 요약"}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: accent.light,
            border: `1px solid ${accent.border}`,
          }}
        >
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            이번 결과
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: accent.strong }}>
            {current.measuredSps}
          </div>
          <div style={{ marginTop: 8 }}>
            <span
              style={{
                ...getFeedbackStyle(current.feedback),
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {current.feedback}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fafafa",
            border: "1px solid #e5e5e5",
          }}
        >
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            직전 결과
          </div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {previous ? previous.measuredSps : "-"}
          </div>
          <div style={{ marginTop: 8 }}>
            {previous ? (
              <span
                style={{
                  ...getFeedbackStyle(previous.feedback),
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {previous.feedback}
              </span>
            ) : (
              <span style={{ color: "#777", fontSize: 13 }}>
                직전 기록 없음
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fafafa",
            border: "1px solid #e5e5e5",
          }}
        >
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            최근 {summary.recentCount}회 평균 SPS
          </div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {summary.avgRecentFive.toFixed(2)}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
            적절 비율 {summary.adequateRate.toFixed(0)}%
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fcfcfc",
            border: "1px solid #ececec",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            목표 SPS와의 차이
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {formatDelta(summary.targetDiff)}
          </div>
          <div style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
            목표 {current.targetSps} 대비 실제 {current.measuredSps}
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fcfcfc",
            border: "1px solid #ececec",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            직전 대비 변화
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {summary.changeFromPrevious !== null
              ? formatDelta(summary.changeFromPrevious)
              : "-"}
          </div>
          <div style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
            {summary.changeMeaning ?? "직전 기록이 없어 비교할 수 없어요."}
          </div>
        </div>
      </div>
    </section>
  );
}