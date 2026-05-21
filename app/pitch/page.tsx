import Link from "next/link";
import PitchMeter from "@/components/PitchMeter";

export default function PitchPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">실시간 피치·강도</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            마이크에 발성하면 한 번의 녹음으로 기본주파수(F0)와 음성강도(dB)가
            두 시계열 그래프에 동시에 표시됩니다. 각 그래프의 두 가로선을 끌어
            목표 음역대·강도 구간을 설정하고 머문 비율을 확인하세요. 강도
            바이오피드백(LSVT LOUD 기반)이 통합되어 있습니다.
          </p>
        </div>
        <PitchMeter />
      </div>
    </main>
  );
}
