"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AnatomicalDiagram from "./vocalTract/AnatomicalDiagram";
import {
  KOREAN_CONSONANTS,
  consonantsByPlace,
  type KoreanConsonant,
} from "./vocalTract/koreanConsonants";

const PLACE_ORDER = ["양순", "치조", "경구개", "연구개", "성문"] as const;

export default function ConsonantTrainer() {
  const [selected, setSelected] = useState<KoreanConsonant | null>(null);
  const [highPriorityOnly, setHighPriorityOnly] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoIndexRef = useRef(0);
  const autoTimerRef = useRef<number | null>(null);

  const filteredList = useMemo(() => {
    return highPriorityOnly
      ? KOREAN_CONSONANTS.filter(
          (c) => c.priority === "high" || c.priority === "medium",
        )
      : KOREAN_CONSONANTS;
  }, [highPriorityOnly]);

  const groups = useMemo(() => consonantsByPlace(filteredList), [filteredList]);

  useEffect(() => {
    if (!autoPlay) {
      if (autoTimerRef.current !== null) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }
    autoTimerRef.current = window.setInterval(() => {
      const i = autoIndexRef.current % filteredList.length;
      setSelected(filteredList[i]);
      autoIndexRef.current = i + 1;
    }, 2200);
    return () => {
      if (autoTimerRef.current !== null) clearInterval(autoTimerRef.current);
    };
  }, [autoPlay, filteredList]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              자음 학습 모드 — 해부학적 조음 위치
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              임상적으로 자주 왜곡되는 음소를 우선 구성. 연구개 개폐·혁
              위치·공기 흐름이 자음별로 다르게 표시됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={highPriorityOnly}
                onChange={(e) => setHighPriorityOnly(e.target.checked)}
              />
              임상 중요 음소만
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              해부 라벨
            </label>
            <button
              onClick={() => setAutoPlay((v) => !v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                autoPlay
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {autoPlay ? "자동 순회 정지" : "자동 순회"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-[400px]">
            <AnatomicalDiagram
              state={selected?.articulation}
              showLabels={showLabels}
            />
          </div>
          {selected && (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg bg-violet-50 p-3">
                <p className="text-lg font-bold text-violet-900">
                  {selected.hangul}{" "}
                  <span className="text-base font-medium">
                    /{selected.ipa}/
                  </span>
                </p>
                <p className="mt-1 text-xs font-medium text-violet-700">
                  {selected.place} · {selected.manner}
                </p>
                <p className="mt-2 text-sm text-violet-900">
                  {selected.description}
                </p>
              </div>
              {selected.clinical.commonErrors.length > 0 && (
                <div className="rounded-lg bg-rose-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-rose-700">
                    흔한 조음 오류
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-rose-900">
                    {selected.clinical.commonErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.clinical.facilitation.length > 0 && (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-emerald-700">
                    유도 방법
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-emerald-900">
                    {selected.clinical.facilitation.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.clinical.acousticTip && (
                <div className="rounded-lg bg-blue-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-blue-700">
                    음향적 특징
                  </p>
                  <p className="mt-1 text-blue-900">
                    {selected.clinical.acousticTip}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700">자음 선택</h4>
          <div className="mt-3 space-y-3">
            {PLACE_ORDER.map((place) =>
              groups[place] ? (
                <div key={place}>
                  <p className="text-xs font-medium text-slate-500">{place}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {groups[place].map((c) => (
                      <button
                        key={c.hangul}
                        onClick={() => {
                          setSelected(c);
                          setAutoPlay(false);
                        }}
                        className={`min-w-14 rounded-lg border px-3 py-2 text-left transition ${
                          selected?.hangul === c.hangul
                            ? "border-violet-500 bg-violet-100"
                            : "border-slate-300 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`text-base font-bold ${selected?.hangul === c.hangul ? "text-violet-900" : "text-slate-800"}`}
                        >
                          {c.hangul.includes("_") ? c.hangul.split("_")[0] : c.hangul}
                        </div>
                        {c.hangul.includes("_") && (
                          <div className="text-[10px] text-slate-500">
                            {c.hangul.split("_")[1]}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            출처: 이호영(1996) 국어 음성학, 신지영(2014) 말소리의 이해, 김미배·이수환(2017)
            아동 조음음운론 장애 · 조음 위치는 표준 모형이며 화자별 편차 존재.
          </p>
        </div>
      </div>
    </div>
  );
}
