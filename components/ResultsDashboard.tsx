"use client";

import { useEffect, useMemo, useState } from "react";

type ModuleType = "visual" | "audio" | "mixed";

type TrainingItem = {
  id: string;
  savedAt: string;
  moduleType: ModuleType;
  clientName: string;
  sessionNote: string;
  practiceText: string;
  targetSps: number;
  measuredSps: number;
  feedback: string;
  chunkMode: string;
  recordingSec: number;
};

type Props = {
  clientName: string;
};

const STORAGE_KEY = "pd-training-history";

function readHistory(): TrainingItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        id: String(item?.id ?? ""),
        savedAt: String(item?.savedAt ?? ""),
        moduleType: item?.moduleType as ModuleType,
        clientName: String(item?.clientName ?? ""),
        sessionNote: String(item?.sessionNote ?? ""),
        practiceText: String(item?.practiceText ?? ""),
        targetSps: Number(item?.targetSps ?? 0),
        measuredSps: Number(item?.measuredSps ?? 0),
        feedback: String(item?.feedback ?? ""),
        chunkMode: String(item?.chunkMode ?? ""),
        recordingSec: Number(item?.recordingSec ?? 0),
      }))
      .filter(
        (item) =>
          item.id &&
          item.savedAt &&
          ["visual", "audio", "mixed"].includes(item.moduleType)
      )
      .sort(
        (a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
  } catch {
    return [];
  }
}

function writeHistory(items: TrainingItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("pd-training-history-updated"));
}

function formatDateTime(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ko-KR");
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function ratio(part: number, whole: number) {
  if (!whole) return 0;
  return (part / whole) * 100;
}

function downloadCsv(filename: string, rows: TrainingItem[]) {
  const header = [
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

  const escapeCell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        escapeCell(row.savedAt),
        escapeCell(row.moduleType),
        escapeCell(row.clientName),
        escapeCell(row.sessionNote),
        escapeCell(row.practiceText),
        escapeCell(row.targetSps),
        escapeCell(row.measuredSps),
        escapeCell(row.feedback),
        escapeCell(row.chunkMode),
        escapeCell(row.recordingSec),
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SimpleLineChart({
  rows,
}: {
  rows: Array<{ label: string; target: number; measured: number }>;
}) {
  const width = 760;
  const height = 260;
  const padding = 32;

  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.target, row.measured])
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
        표시할 그래프 데이터가 없습니다.
      </div>
    );
  }

  const getX = (index: number) => {
    if (rows.length === 1) return width / 2;
    return padding + (index * (width - padding * 2)) / (rows.length - 1);
  };

  const getY = (value: number) => {
    return height - padding - (value / maxValue) * (height - padding * 2);
  };

  const targetPath = rows
    .map((row, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(row.target)}`)
    .join(" ");

  const measuredPath = rows
    .map((row, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(row.measured)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[260px] min-w-[760px] w-full rounded-xl bg-slate-50"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratioValue, i) => {
          const y = padding + (height - padding * 2) * ratioValue;
          const label = (maxValue * (1 - ratioValue)).toFixed(1);
          return (
            <g key={i}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={8}
                y={y + 4}
                fontSize="11"
                fill="#64748b"
              >
                {label}
              </text>
            </g>
          );
        })}

        <path d={targetPath} fill="none" stroke="#334155" strokeWidth="2" />
        <path d={measuredPath} fill="none" stroke="#2563eb" strokeWidth="3" />

        {rows.map((row, index) => (
          <g key={index}>
            <circle
              cx={getX(index)}
              cy={getY(row.measured)}
              r="4"
              fill="#2563eb"
            />
            <text
              x={getX(index)}
              y={height - 10}
              fontSize="10"
              textAnchor="middle"
              fill="#64748b"
            >
              {row.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-700" />
          목표 SPS
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
          측정 SPS
        </div>
      </div>
    </div>
  );
}

export default function ResultsDashboard({ clientName }: Props) {
  const [items, setItems] = useState<TrainingItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(readHistory());

    refresh();
    window.addEventListener("pd-training-history-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("pd-training-history-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const normalizedClientName = (clientName ?? "").trim();
  const hasSelectedClient = normalizedClientName.length > 0;

  const filteredItems = useMemo(() => {
    if (!hasSelectedClient) return [];
    return items.filter(
      (item) => (item.clientName ?? "").trim() === normalizedClientName
    );
  }, [items, normalizedClientName, hasSelectedClient]);

  const latest = filteredItems[0] ?? null;

  const recent10 = useMemo(() => {
    return [...filteredItems].slice(0, 10).reverse();
  }, [filteredItems]);

  const chartRows = useMemo(() => {
    return recent10.map((row, index) => ({
      label: `${index + 1}`,
      target: row.targetSps,
      measured: row.measuredSps,
    }));
  }, [recent10]);

  const moduleStats = useMemo(() => {
    const base: Record<
      ModuleType,
      {
        count: number;
        avgSps: number;
        latestSps: number;
        properRate: number;
        latestFeedback: string;
      }
    > = {
      visual: {
        count: 0,
        avgSps: 0,
        latestSps: 0,
        properRate: 0,
        latestFeedback: "-",
      },
      audio: {
        count: 0,
        avgSps: 0,
        latestSps: 0,
        properRate: 0,
        latestFeedback: "-",
      },
      mixed: {
        count: 0,
        avgSps: 0,
        latestSps: 0,
        properRate: 0,
        latestFeedback: "-",
      },
    };

    (["visual", "audio", "mixed"] as ModuleType[]).forEach((moduleType) => {
      const rows = filteredItems.filter((item) => item.moduleType === moduleType);
      const latestRow = rows[0];

      base[moduleType] = {
        count: rows.length,
        avgSps: avg(rows.map((row) => row.measuredSps)),
        latestSps: latestRow?.measuredSps ?? 0,
        properRate: ratio(
          rows.filter((row) => row.feedback === "적절").length,
          rows.length
        ),
        latestFeedback: latestRow?.feedback ?? "-",
      };
    });

    return base;
  }, [filteredItems]);

  const overallStats = useMemo(() => {
    const properCount = filteredItems.filter(
      (row) => row.feedback === "적절"
    ).length;

    const targetAvg = avg(filteredItems.map((row) => row.targetSps));
    const measuredAvg = avg(filteredItems.map((row) => row.measuredSps));

    const first3 = [...filteredItems].slice(-3);
    const last3 = [...filteredItems].slice(0, 3);

    return {
      totalCount: filteredItems.length,
      properRate: ratio(properCount, filteredItems.length),
      avgTargetSps: targetAvg,
      avgMeasuredSps: measuredAvg,
      first3Avg: avg(first3.map((row) => row.measuredSps)),
      last3Avg: avg(last3.map((row) => row.measuredSps)),
    };
  }, [filteredItems]);

  function handleDeleteCurrentClientRecords() {
    if (!hasSelectedClient) return;

    const recordCount = filteredItems.length;

    if (recordCount === 0) {
      alert("삭제할 기록이 없습니다.");
      return;
    }

    const confirmed = window.confirm(
      `'${normalizedClientName}' 대상자의 기록 ${recordCount}건을 모두 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmed) return;

    const remainingItems = items.filter(
      (item) => (item.clientName ?? "").trim() !== normalizedClientName
    );

    writeHistory(remainingItems);
    setItems(remainingItems);
  }

  if (!hasSelectedClient) {
    return (
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">결과 대시보드</h2>
        <p className="mt-3 text-sm text-slate-600">
          홈에서 대상자 이름을 먼저 저장한 뒤 결과를 확인하세요.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">이번 회기 요약</h2>
            <p className="mt-2 text-sm text-slate-500">
              현재 대상자: <span className="font-medium text-slate-700">{normalizedClientName}</span>
            </p>
          </div>

          <button
            onClick={handleDeleteCurrentClientRecords}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            현재 대상자 기록 전체 삭제
          </button>
        </div>

        {!latest ? (
          <p className="mt-4 text-sm text-slate-500">
            선택한 대상자의 저장 기록이 없습니다.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">대상자</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {latest.clientName || "이름 없음"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">모듈</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {latest.moduleType}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">목표 SPS</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {latest.targetSps.toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">측정 SPS</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {latest.measuredSps.toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">차이</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {(latest.measuredSps - latest.targetSps).toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">녹음 시간</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {latest.recordingSec.toFixed(2)}초
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">읽기 단위</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {latest.chunkMode || "-"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">결과</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {latest.feedback || "-"}
              </div>
            </div>
          </div>
        )}

        {latest?.sessionNote ? (
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-700">세션 메모</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {latest.sessionNote}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">최근 SPS 변화</h2>
        <p className="mt-2 text-sm text-slate-500">
          최근 10회 기준으로 목표 SPS와 측정 SPS를 표시합니다.
        </p>

        <div className="mt-5">
          <SimpleLineChart rows={chartRows} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">
          같은 사용자 모듈 비교
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {(["visual", "audio", "mixed"] as ModuleType[]).map((moduleType) => {
            const stat = moduleStats[moduleType];
            return (
              <div key={moduleType} className="rounded-xl border border-slate-200 p-4">
                <div className="text-lg font-semibold text-slate-900">
                  {moduleType}
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div>회기 수: {stat.count}</div>
                  <div>최근 SPS: {stat.latestSps.toFixed(2)}</div>
                  <div>평균 SPS: {stat.avgSps.toFixed(2)}</div>
                  <div>적절 비율: {stat.properRate.toFixed(1)}%</div>
                  <div>최근 결과: {stat.latestFeedback}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">환자별 기록 정리</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">전체 회기 수</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {overallStats.totalCount}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">전체 평균 SPS</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {overallStats.avgMeasuredSps.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">평균 목표 SPS</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {overallStats.avgTargetSps.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">적절 비율</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {overallStats.properRate.toFixed(1)}%
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">초기 3회 평균</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {overallStats.first3Avg.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">최근 3회 평균</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {overallStats.last3Avg.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
            <div className="text-sm text-slate-500">자동 요약</div>
            <div className="mt-1 text-sm text-slate-700">
              최근 3회 평균 SPS는 {overallStats.last3Avg.toFixed(2)}이며, 초기
              3회 평균 SPS는 {overallStats.first3Avg.toFixed(2)}입니다. 전체
              적절 비율은 {overallStats.properRate.toFixed(1)}%입니다.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">CSV 다운로드</h2>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() =>
              downloadCsv(`${normalizedClientName}_all_records.csv`, filteredItems)
            }
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
          >
            전체 CSV
          </button>

          <button
            onClick={() =>
              downloadCsv(
                `${normalizedClientName}_visual_records.csv`,
                filteredItems.filter((row) => row.moduleType === "visual")
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
          >
            시각 CSV
          </button>

          <button
            onClick={() =>
              downloadCsv(
                `${normalizedClientName}_audio_records.csv`,
                filteredItems.filter((row) => row.moduleType === "audio")
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
          >
            청각 CSV
          </button>

          <button
            onClick={() =>
              downloadCsv(
                `${normalizedClientName}_mixed_records.csv`,
                filteredItems.filter((row) => row.moduleType === "mixed")
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
          >
            혼합 CSV
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">최근 기록 목록</h2>

        {!filteredItems.length ? (
          <p className="mt-4 text-sm text-slate-500">선택한 대상자의 저장 기록이 없습니다.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-3">저장 시각</th>
                  <th className="px-3 py-3">모듈</th>
                  <th className="px-3 py-3">대상자</th>
                  <th className="px-3 py-3">목표 SPS</th>
                  <th className="px-3 py-3">측정 SPS</th>
                  <th className="px-3 py-3">결과</th>
                  <th className="px-3 py-3">읽기 단위</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-700">
                      {formatDateTime(item.savedAt)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{item.moduleType}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.clientName || "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.targetSps.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.measuredSps.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{item.feedback}</td>
                    <td className="px-3 py-3 text-slate-700">{item.chunkMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}