"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MODULE_LABELS,
  VOICE_LAB_HISTORY_EVENT,
  clearVoiceLabHistory,
  deleteVoiceLabRecord,
  exportHistoryToCSV,
  getVoiceLabHistory,
  type VoiceLabModuleId,
  type VoiceLabRecord,
} from "@/components/voiceLabHistory";

const MODULES: VoiceLabModuleId[] = [
  "mpt",
  "voice_quality",
  "intensity_trainer",
  "speech_rate",
  "fluency",
  "pitch",
];

export default function HistoryPage() {
  const [records, setRecords] = useState<VoiceLabRecord[]>([]);
  const [filterModule, setFilterModule] = useState<"" | VoiceLabModuleId>("");
  const [filterClient, setFilterClient] = useState("");

  const refresh = useCallback(() => {
    setRecords(getVoiceLabHistory());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(VOICE_LAB_HISTORY_EVENT, handler);
    return () => window.removeEventListener(VOICE_LAB_HISTORY_EVENT, handler);
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = filterClient.trim().toLowerCase();
    return records.filter((r) => {
      if (filterModule && r.moduleId !== filterModule) return false;
      if (q && !r.clientName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, filterModule, filterClient]);

  const clients = useMemo(() => {
    const s = new Set<string>();
    for (const r of records) if (r.clientName) s.add(r.clientName);
    return Array.from(s).sort();
  }, [records]);

  const onExport = () => {
    const csv = exportHistoryToCSV(filtered);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `voice_lab_history_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onClear = () => {
    if (!confirm("저장된 모든 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    clearVoiceLabHistory();
    refresh();
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Voice Lab 허브로
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">세션 기록</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            각 모듈에서 「기록 저장」 버튼으로 보관한 결과를 한 곳에서
            조회·내보내기할 수 있습니다. 데이터는 이 브라우저의 localStorage
            에 저장되며 서버로 전송되지 않습니다.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                모듈 필터
              </label>
              <select
                value={filterModule}
                onChange={(e) =>
                  setFilterModule(e.target.value as "" | VoiceLabModuleId)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {MODULE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                대상자 검색
              </label>
              <input
                type="text"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                list="vl-clients"
                placeholder="이름 / ID 일부"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <datalist id="vl-clients">
                {clients.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={onExport}
                disabled={filtered.length === 0}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                CSV 내보내기
              </button>
              <button
                onClick={onClear}
                disabled={records.length === 0}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                전체 삭제
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            총 {records.length}건 · 필터 결과 {filtered.length}건
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            저장된 기록이 없습니다. 각 모듈 결과 화면에서 「기록에 저장」 버튼을
            사용해 주세요.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">시각</th>
                  <th className="px-4 py-3">모듈</th>
                  <th className="px-4 py-3">대상자</th>
                  <th className="px-4 py-3">요약</th>
                  <th className="px-4 py-3">비고</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-slate-600">
                      {formatDate(r.savedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {MODULE_LABELS[r.moduleId]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-800">
                      {r.clientName || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <SummaryCells summary={r.summary} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {r.notes || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm("이 기록을 삭제하시겠습니까?")) {
                            deleteVoiceLabRecord(r.id);
                            refresh();
                          }
                        }}
                        className="text-xs text-slate-400 hover:text-rose-600"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCells({
  summary,
}: {
  summary: Record<string, number | string>;
}) {
  const entries = Object.entries(summary);
  if (entries.length === 0)
    return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs"
        >
          <span className="text-slate-500">{k}</span>
          <span className="font-semibold tabular-nums text-slate-800">
            {typeof v === "number" ? formatNum(v) : v}
          </span>
        </span>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatNum(n: number): string {
  if (!isFinite(n)) return String(n);
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
