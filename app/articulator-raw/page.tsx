"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const RawMorphViewer = dynamic(() => import("@/components/RawMorphViewer"), {
  ssr: false,
});

export default function ArticulatorRawPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← 홈으로
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
            RAW 모프 검증 (v2.5 재납품)
          </h1>
          <span className="text-xs text-slate-400">raw</span>
        </div>
        <p className="text-xs text-slate-500 sm:text-sm">
          <code>head-rigged-v25.glb</code> — 보정 없이 모든 모프를 슬라이더로 직접
          적용(velum 반전·정점해킹·턱커플링 전부 제거). 리거 셰이프 자체 확인용.
        </p>
        <RawMorphViewer />
      </div>
    </main>
  );
}
