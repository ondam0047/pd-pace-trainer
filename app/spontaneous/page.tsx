"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const APP_URL = "https://dllanguage.streamlit.app";
const EMBED_URL = `${APP_URL}/?embed=true`;

export default function SpontaneousPage() {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 임베딩이 막히거나 sleep 깨우기가 느릴 때 폴백 안내 노출
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!loaded) setSlow(true);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [loaded]);

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
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            🟡 말 흐름 · 외부 도구
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            자발화 언어/조음 분석
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            한국어 전사 기반 자발화 분석 도구입니다. 별도 Streamlit 앱으로
            동작하며 아래에 바로 내장되어 있습니다. 처음 열 때 앱이 절전에서
            깨어나는 데 수십 초가 걸릴 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              새 탭에서 열기 ↗
            </a>
            <span className="text-xs text-slate-500">
              아래 화면이 비어 보이거나 오류가 나면 새 탭에서 열어주세요.
            </span>
          </div>
        </div>

        {slow && !loaded && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            앱 로딩이 지연되고 있습니다. 절전 모드 깨우는 중일 수 있어요. 잠시
            기다리거나{" "}
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              새 탭에서 열기
            </a>
            를 눌러주세요.
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                <p className="text-sm">전사 분석 앱 불러오는 중…</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={EMBED_URL}
            title="한국어 자발화 전사 분석"
            onLoad={() => setLoaded(true)}
            className="h-[80vh] w-full"
            allow="microphone; clipboard-read; clipboard-write"
          />
        </div>

        <p className="text-xs text-slate-500">
          본 도구는 Voice Lab 외부의 독립 앱입니다. 데이터 처리·저장 정책은
          해당 앱을 따릅니다.
        </p>
      </div>
    </main>
  );
}
