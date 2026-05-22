import Link from "next/link";
import VocalTractMode from "@/components/VocalTractMode";

export default function VocalTractPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">모음·자음 시각화</h1>
          <p className="mt-2 max-w-3xl text-slate-600">마찰음 훈련 (/s/ · /ʃ/ · /ɕ/ 스펙트럼 중심)을 제공합니다. 3D 조음 모드는 현재 수정 중입니다.</p>
        </div>
        <VocalTractMode />
      </div>
    </main>
  );
}
