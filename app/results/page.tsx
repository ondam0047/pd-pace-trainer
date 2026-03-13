"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ResultsDashboard from "@/components/ResultsDashboard";
import {
  clearCurrentSession,
  getCurrentSession,
  saveCurrentSession,
} from "@/components/currentSessionStorage";

export default function ResultsPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [clientName, setClientName] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);

    const session = getCurrentSession();
    setClientName(session.clientName);
    setSessionNote(session.sessionNote);

    const handleSessionUpdated = () => {
      const nextSession = getCurrentSession();
      setClientName(nextSession.clientName);
      setSessionNote(nextSession.sessionNote);
    };

    window.addEventListener("pd-current-session-updated", handleSessionUpdated);

    return () => {
      window.removeEventListener(
        "pd-current-session-updated",
        handleSessionUpdated
      );
    };
  }, []);

  const handleSave = () => {
    saveCurrentSession({ clientName, sessionNote });
    setSavedMessage("현재 세션 정보 저장 완료");
    window.setTimeout(() => setSavedMessage(""), 1500);
  };

  const handleClear = () => {
    clearCurrentSession();
    setClientName("");
    setSessionNote("");
    setSavedMessage("현재 세션 정보 초기화 완료");
    window.setTimeout(() => setSavedMessage(""), 1500);
  };

  if (!hasMounted) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">결과 대시보드</h1>
          <p className="mt-3 text-slate-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                결과 대시보드
              </h1>
              <p className="mt-2 text-slate-600">
                홈에서 저장한 대상자 정보를 기준으로 기록을 확인합니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
              >
                홈으로
              </Link>
              <Link
                href="/visual"
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700"
              >
                시각 훈련
              </Link>
              <Link
                href="/audio"
                className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700"
              >
                청각 훈련
              </Link>
              <Link
                href="/mixed"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              >
                혼합 훈련
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            현재 조회 대상
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                대상자 이름 / ID
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="예: 김OO / PD-001"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                세션 메모
              </label>
              <textarea
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
            >
              조회 대상 저장
            </button>

            <button
              onClick={handleClear}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700"
            >
              조회 대상 초기화
            </button>
          </div>

          {savedMessage ? (
            <p className="mt-4 text-sm font-medium text-emerald-600">
              {savedMessage}
            </p>
          ) : null}
        </section>

        <ResultsDashboard clientName={clientName} />
      </div>
    </main>
  );
}