"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// Three.js / WebGL must load only on the client.
const RiggedViewer = dynamic(() => import("@/components/RiggedViewer"), {
  ssr: false,
});

export default function ArticulatorVerifyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← 홈으로
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
            조음기관 음소 산출
          </h1>
          <span className="text-xs text-slate-400">verify</span>
        </div>

        <p className="text-xs text-slate-500 sm:text-sm">
          리거 납품 <code>head-rigged.glb</code>로 한국어 자음·모음·이중모음을
          산출합니다. 음소→블렌드셰이프 매핑·이중모음 보간·입술 투명도·턱 추종은{" "}
          <strong>웹 코드</strong>에서 처리(운영 패턴과 동일). 리거 재작업 항목 점검용.
        </p>

        <RiggedViewer />
      </div>
    </main>
  );
}
