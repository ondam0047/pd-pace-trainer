import Link from "next/link";
import PitchMeter from "@/components/PitchMeter";

export default function PitchPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">실시간 피치·강도</h1>
          <p className="mt-2 max-w-3xl text-slate-600">마이크에 발성하면 기본주파수(F0)가 실시간 시계열 그래프에 표시됩니다. 그래프 위의 두 가로선을 끌어 목표 음역대를 설정하고 머문 비율을 확인합니다.</p>
          <p className="mt-2 max-w-3xl text-xs text-slate-500">ⓘ 음성강도(dB) 측정 탭은 곳 이어서 추가됩니다. 현재는 기본주파수(F0) 추적을 이용하세요.</p>
        </div>
        <PitchMeter />
      </div>
    </main>
  );
}
