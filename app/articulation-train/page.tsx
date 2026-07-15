"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// Three.js / WebGL must load only on the client.
const ArticulationTrainer = dynamic(
  () => import("@/components/articulationTrainer/ArticulationTrainer"),
  { ssr: false },
);

export default function ArticulationTrainPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← 홈으로
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
            음운변동 조음 훈련
          </h1>
          <Link
            href="/articulator-compare"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            비교뷰 →
          </Link>
        </div>

        <p className="text-xs text-slate-500 sm:text-sm">
          음운변동(연구개음 전방화·마찰음 파열음화·ㄹ 탄설/설측 등)별로 <strong>대립쌍 대조</strong>와
          <strong> 오류→목표 3D 애니메이션</strong>으로 조음위치를 가르칩니다. 지속음은 실시간 음향
          게이지로 목표대역 도달을 확인합니다. (근거 기반: 최소대립쌍·단순 시상면 애니메이션·운동학습 원리)
        </p>

        <ArticulationTrainer />
      </div>
    </main>
  );
}
