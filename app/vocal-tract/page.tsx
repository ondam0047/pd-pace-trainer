import Link from "next/link";

export default function VocalTractPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Voice Lab 허브로
        </Link>

        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-violet-900">성도 시각화</h1>
          <p className="mt-2 text-sm font-semibold text-violet-700">
            Vocal Tract Visualizer
          </p>
          <p className="mt-6 leading-relaxed text-violet-900">
            한국어 자음·모음 산출 시 혀와 성도의 움직임을 실시간으로 표시할
            모듈입니다. Phase 3에서 본격 개발 예정이며, 다음 작업들이
            포함됩니다.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-violet-900">
            <li>
              한국어 자음(양순/치조/경구개/연구개/성문) 조음 위치 근거 정리
              (Shin·Cha·Kim, Cho·Keating 등)
            </li>
            <li>
              한국어 모음 F1/F2 표준 값(이호영·신지영) 기반 혀 위치 매핑
            </li>
            <li>
              Web Audio API + LPC 또는 cepstrum으로 실시간 F1/F2 추출
            </li>
            <li>SVG 측면 성도 단면도에 혀 위치/조음점 애니메이션</li>
            <li>
              정조음 비교 피드백: 목표 위치 vs. 사용자 추정 위치 시각화
            </li>
          </ul>
          <p className="mt-6 text-sm text-violet-700">
            교수님과 자음·모음 근거 자료 합의 후 본격 구현합니다.
          </p>
        </div>
      </div>
    </main>
  );
}
