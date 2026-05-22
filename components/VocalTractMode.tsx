"use client";

import SibilantTrainer from "./SibilantTrainer";

export default function VocalTractMode() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="min-w-[160px] flex-1 rounded-xl bg-violet-600 px-4 py-2 text-left text-white shadow">
          <div className="text-sm font-semibold">마찰음 훈련</div>
          <div className="text-[11px] text-violet-100">/s/ · /ʃ/ · /ɕ/ 스펙트럼 중심</div>
        </div>
        <div
          className="min-w-[160px] flex-1 cursor-not-allowed rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-left opacity-80"
          aria-disabled="true"
          title="현재 수정 중입니다"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            3D 조음
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              수정중
            </span>
          </div>
          <div className="text-[11px] text-slate-400">현재 사용할 수 없습니다</div>
        </div>
      </div>

      <SibilantTrainer />
    </div>
  );
}
