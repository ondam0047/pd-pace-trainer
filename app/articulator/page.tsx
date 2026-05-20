"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

// Three.js / WebGL must load only on the client.
const ArticulatorViewer = dynamic(
  () => import("@/components/ArticulatorViewer"),
  { ssr: false },
);
const GlbHybridViewer = dynamic(() => import("@/components/GlbHybridViewer"), {
  ssr: false,
});

type Mode = "procedural" | "glb";

export default function ArticulatorPage() {
  const [mode, setMode] = useState<Mode>("procedural");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← 홈으로
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
            조음기관 3D 뷰어
          </h1>
          <span className="text-xs text-slate-400">prototype</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("procedural")}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (mode === "procedural"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200")
            }
          >
            절차적 (애니메이션)
          </button>
          <button
            onClick={() => setMode("glb")}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (mode === "glb"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200")
            }
          >
            실사 + 가동부 (하이브리드)
          </button>
        </div>

        <p className="text-xs text-slate-500 sm:text-sm">
          {mode === "procedural"
            ? "입술·혀·경구개·연구개가 자음에 맞춰 반복 조음하고 공기가 흐릅니다. 마우스로 회전, 휠로 줌."
            : "실사 GLB(고정) + 움직이는 조음부(연구개·혀끝·혀몸·입술). 정렬 후 슬라이더/재생으로 조음."}
        </p>

        {mode === "procedural" ? <ArticulatorViewer /> : <GlbHybridViewer />}
      </div>
    </main>
  );
}
