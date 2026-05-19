import Link from "next/link";
import PitchMeter from "@/components/PitchMeter";

export default function PitchPage() {
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
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-blue-700">
            🔵 음향 분석
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            실시간 피치 분석
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            마이크에 발성하면 기본주파수(F0)가 실시간 시계열 그래프에
            표시됩니다. 그래프 위의 두 가로선을 끌어 목표 음역대를 설정하고
            머문 비율을 확인합니다.
          </p>
        </div>
        <PitchMeter />
      </div>
    </main>
  );
}
