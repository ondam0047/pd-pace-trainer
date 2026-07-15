"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// Three.js / WebGL must load only on the client.
const CompareViewer = dynamic(() => import("@/components/CompareViewer"), {
  ssr: false,
});

export default function ArticulatorComparePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← 홈으로
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
            조음 위치 비교 · 목표 vs 실제
          </h1>
          <Link
            href="/articulator-verify"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            음소 산출 →
          </Link>
        </div>

        <p className="text-xs text-slate-500 sm:text-sm">
          아동이 산출한 음소의 조음 자세를 <strong>목표 음소</strong>와 나란히 비교합니다.
          v1 조음 자세 라이브러리를 재사용해 두 자세를 3D로 보여주고, 조음 요소별 차이를
          정리합니다. (v2 다음 단계: 아동 단어 발화의 음향 분석으로 &lsquo;실제&rsquo; 자동 판정)
        </p>

        <CompareViewer />
      </div>
    </main>
  );
}
