import Link from "next/link";
import VocalTractMode from "@/components/VocalTractMode";

export default function VocalTractPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Voice Lab 허브로
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">성도 시각화</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            세 가지 모드로 운영됩니다: (1) 모음 분석 — 실시간 F1/F2로 한국어
            단모음 8개 위치 표시, (2) 자음 학습 — 버튼으로 각 자음의 조음
            위치 시각화, (3) 마찰음 훈련 — /s/·/ʃ/ 스펙트럼 중심 변별.
          </p>
        </div>
        <VocalTractMode />
      </div>
    </main>
  );
}
