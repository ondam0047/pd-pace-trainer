import Link from "next/link";

export default function DiagnosisPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Voice Lab 허브로
        </Link>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-amber-900">
            PD Voice Diagnosis
          </h1>
          <p className="mt-2 text-sm font-semibold text-amber-700">
            파킨슨 하위 유형 분류
          </p>
          <p className="mt-6 leading-relaxed text-amber-900">
            본 모듈은 별도의 Streamlit + Python 백엔드로 동작합니다.
            parselmouth(Praat)와 scikit-learn으로 음향 피처를 추출하고
            PD_Intensity / PD_Rate / PD_Articulation / Normal 네 가지 하위
            유형을 분류합니다.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-amber-900">
            <li>현재 표본: PD 68명, CG 70명 (총 138명)</li>
            <li>
              피처: F0, Range, 강도(dB), SPS + 청지각 5종 + VHI 4종
            </li>
            <li>
              Phase 4에서 결측치/클래스 불균형 처리, jitter·shimmer·HNR·MFCC
              추가, 교차검증 보고서 등 ML 강화 예정
            </li>
          </ul>
          <p className="mt-6 rounded-lg border border-amber-300 bg-white/60 px-4 py-3 text-sm text-amber-800">
            ⓘ 배포 환경 검토 중입니다. Streamlit Cloud(sleep 이슈)를 대체할
            방안으로 Hugging Face Spaces 또는 AWS EC2 t4g.small 옵션을 검토
            중이며, 결정 후 이 카드에서 직접 실행할 수 있도록 연결합니다.
          </p>
        </div>
      </div>
    </main>
  );
}
