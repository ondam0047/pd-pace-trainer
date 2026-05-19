"use client";

import { useState } from "react";
import VocalTractVisualizer from "./VocalTractVisualizer";
import ConsonantTrainer from "./ConsonantTrainer";
import SibilantTrainer from "./SibilantTrainer";

type Mode = "vowel" | "consonant" | "sibilant";

const TABS: { id: Mode; label: string; subtitle: string }[] = [
  { id: "vowel", label: "모음 분석", subtitle: "LPC F1/F2 실시간" },
  { id: "consonant", label: "자음 학습", subtitle: "조음 위치 시각화" },
  { id: "sibilant", label: "마찰음 훈련", subtitle: "/s/ vs /ʃ/ 스펙트럼 중심" },
];

export default function VocalTractMode() {
  const [mode, setMode] = useState<Mode>("vowel");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 min-w-[140px] rounded-xl px-4 py-2 text-left transition ${
              mode === t.id
                ? "bg-violet-600 text-white shadow"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <div className="text-sm font-semibold">{t.label}</div>
            <div
              className={`text-[11px] ${mode === t.id ? "text-violet-100" : "text-slate-500"}`}
            >
              {t.subtitle}
            </div>
          </button>
        ))}
      </div>

      {mode === "vowel" && <VocalTractVisualizer />}
      {mode === "consonant" && <ConsonantTrainer />}
      {mode === "sibilant" && <SibilantTrainer />}
    </div>
  );
}
