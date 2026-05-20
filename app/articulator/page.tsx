"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// Three.js / WebGL must load only on the client.
const ArticulatorViewer = dynamic(
  () => import("@/components/ArticulatorViewer"),
  { ssr: false },
);

export default function ArticulatorPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← 홈으로
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
            조음기관 3D 뷰어
          </h1>
          <span className="text-xs text-slate-400">prototype</span>
        </div>

        <p className="text-xs text-slate-500 sm:text-sm">
          입술 · 혀 · 경구개 · 연구개의 움직임을 3차원으로 시각화합니다. 마우스로
          측면 · 후면 · 정면을 자유롭게 둘러볼 수 있고, 휠로 줌 인/아웃이
          가능합니다.
        </p>

        <ArticulatorViewer />
      </div>
    </main>
  );
}
