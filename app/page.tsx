"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearCurrentSession,
  getCurrentSession,
  saveCurrentSession,
} from "@/components/currentSessionStorage";

export default function HomePage() {
  const router = useRouter();

  const [hasMounted, setHasMounted] = useState(false);
  const [clientName, setClientName] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);

    const session = getCurrentSession();
    setClientName(session.clientName);
    setSessionNote(session.sessionNote);
  }, []);

  const handleSaveSession = () => {
    saveCurrentSession({ clientName, sessionNote });
    setSavedMessage("현재 세션 정보 저장 완료");
    window.setTimeout(() => setSavedMessage(""), 1500);
  };

  const handleClearSession = () => {
    clearCurrentSession();
    setClientName("");
    setSessionNote("");
    setSavedMessage("현재 세션 정보 초기화 완료");
    window.setTimeout(() => setSavedMessage(""), 1500);
  };

  const moveTo = (path: string) => {
    saveCurrentSession({ clientName, sessionNote });
    router.push(path);
  };

  if (!hasMounted) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            PD Pace Trainer
          </h1>
          <p className="mt-3 text-slate-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            PD Pace Trainer
          </h1>
          <p className="mt-3 text-slate-600">
            파킨슨병 환자의 말속도 조절 훈련을 위한 홈 화면입니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900">
              공통 세션 정보
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              홈에서 먼저 대상자 정보와 세션 메모를 저장한 뒤 각 훈련으로
              이동합니다.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                대상자 이름 / ID
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="예: 김OO / PD-001"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 transition focus:border-slate-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                세션 메모
              </label>
              <textarea
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
                placeholder="예: 오늘은 3단어 chunk 중심으로 진행. 속도는 5.5 SPS 목표."
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 transition focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleSaveSession}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
            >
              세션 정보 저장
            </button>

            <button
              onClick={handleClearSession}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700"
            >
              세션 정보 초기화
            </button>
          </div>

          {savedMessage ? (
            <p className="mt-4 text-sm font-medium text-emerald-600">
              {savedMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            훈련 시작
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            아래 버튼을 누르면 현재 홈에 입력한 대상자 정보가 저장된 뒤 해당
            훈련 화면으로 이동합니다.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button
              onClick={() => moveTo("/visual")}
              className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-5 text-left transition hover:shadow-sm"
            >
              <div className="text-lg font-semibold text-blue-800">
                시각 단서 훈련
              </div>
              <div className="mt-2 text-sm text-blue-700">
                시각 페이싱 바 중심 훈련
              </div>
            </button>

            <button
              onClick={() => moveTo("/audio")}
              className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-5 text-left transition hover:shadow-sm"
            >
              <div className="text-lg font-semibold text-orange-800">
                청각 단서 훈련
              </div>
              <div className="mt-2 text-sm text-orange-700">
                구 시작 청각 cue 중심 훈련
              </div>
            </button>

            <button
              onClick={() => moveTo("/mixed")}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-left transition hover:shadow-sm"
            >
              <div className="text-lg font-semibold text-emerald-800">
                혼합 훈련
              </div>
              <div className="mt-2 text-sm text-emerald-700">
                시각 + 청각 단서 혼합 훈련
              </div>
            </button>

            <button
              onClick={() => moveTo("/results")}
              className="rounded-2xl border border-slate-300 bg-slate-100 px-5 py-5 text-left transition hover:shadow-sm"
            >
              <div className="text-lg font-semibold text-slate-800">
                결과 보기
              </div>
              <div className="mt-2 text-sm text-slate-600">
                회기 요약 / 변화 / 비교 / CSV
              </div>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}