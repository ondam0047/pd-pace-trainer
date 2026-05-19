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
            마이크에 발성하면 기본주파수(F0)가 실시간 시계열 그래프에
            표시됩니다. 그래프 위의 두 가로선을 끌어 목표 음역대를 설정하고
            머문 비율을 확인합니다.
          </p>
          <div className="mt-3 max-w-3xl rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            강도(dB) 측정은 이 페이지와 같은 패턴으로
            {" "}<Link href="/intensity-trainer" className="font-semibold underline">강도 바이오피드백 훈련</Link>
            {" "}모듈에서 사용하세요. 동일한 시계열 그래프 + 드래그 가이드라인으로
            목표 구간 도달률을 확인할 수 있습니다.
          </div>
        </div>
        <PitchMeter />
      </div>
    </main>
  );
}
