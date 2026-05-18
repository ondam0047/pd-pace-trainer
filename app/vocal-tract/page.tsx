import Link from "next/link";
import VocalTractVisualizer from "@/components/VocalTractVisualizer";

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
            모음 발성 시 추출되는 포먼트(F1·F2·F3)로부터 혀와 성도의 위치를
            추정해 실시간으로 표시합니다. 먼저 참조 화자(남성·여성)을 선택한 뒤
            단모음 8개(ㅣㅔㅐㅏㅓㅗㅜㅡ)를 길게 발성해 보세요.
          </p>
        </div>
        <VocalTractVisualizer />
      </div>
    </main>
  );
}
