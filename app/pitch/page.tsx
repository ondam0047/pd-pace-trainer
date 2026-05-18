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
          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            실시간 음도 측정
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            마이크에 발성하면 기본주파수(F0)가 실시간 시계열 그래프에
            표시됩니다. 그래프 위의 두 가로선을 끌어 올리거나 내려 목표
            음역대를 설정하세요. 측정 시간은 15·30·45·60초 중에서 선택할 수
            있습니다.
          </p>
        </div>
        <PitchMeter />
      </div>
    </main>
  );
}
