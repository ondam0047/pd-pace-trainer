"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SaveToHistory from "@/components/SaveToHistory";
import {
  VHI_ITEMS,
  VHI_SCALE,
  SUBSCALE_LABEL,
  computeVhi,
} from "@/components/vhi/vhiData";
import { downloadVhiReport } from "@/components/vhi/vhiReport";

type Stage = "intro" | "quiz" | "done";

const TOTAL = VHI_ITEMS.length;

export default function VhiPage() {
  const [stage, setStage] = useState<Stage>("intro");
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => Array(TOTAL).fill(null),
  );
  const [idx, setIdx] = useState(0);
  const stageRef = useRef<Stage>("intro");
  const idxRef = useRef(0);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === TOTAL;

  const answer = useCallback((value: number) => {
    const i = idxRef.current;
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
    if (i < TOTAL - 1) setIdx(i + 1);
    else setStage("done");
  }, []);

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  // 키보드 0~4 응답, ← 이전
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (stageRef.current !== "quiz") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key >= "0" && e.key <= "4") {
        e.preventDefault();
        answer(parseInt(e.key, 10));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [answer, goPrev]);

  const start = () => {
    setStage("quiz");
    setIdx(0);
  };
  const restart = () => {
    setAnswers(Array(TOTAL).fill(null));
    setIdx(0);
    setStage("intro");
  };
  const editFromStart = () => {
    setIdx(0);
    setStage("quiz");
  };

  const result = computeVhi(answers);
  const item = VHI_ITEMS[idx];
  const SEV_STEPS = ["정상", "살짝 좋지 않음", "좋지 않음", "심각함"];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Voice Lab 허브로
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
            🔵 자기보고 평가
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            음성장애지수 (VHI)
          </h1>
          <p className="mt-2 text-slate-600">
            30개 문항에 응답하면 기능(F)·신체(P)·정서(E) 점수와 총점·중증도를
            산출하고 보고서로 내려받을 수 있습니다.
          </p>
        </div>

        {/* ── 시작 ── */}
        {stage === "intro" && (
          <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">
              다음 문장들은 목소리가 삶에 미치는 영향을 기술한 것입니다. 얼마나
              자주 같은 경험을 하는지 0~4 로 응답하세요. 한 문항을 선택하면 다음
              문항으로 자동 이동합니다.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {VHI_SCALE.map((s) => (
                <div
                  key={s.value}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs text-slate-600"
                >
                  <div className="text-base font-bold text-slate-900">
                    {s.value}
                  </div>
                  {s.label}
                </div>
              ))}
            </div>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              대상자 이름 / ID (선택)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={start}
              className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              설문 시작 (1 / {TOTAL})
            </button>
          </div>
        )}

        {/* ── 설문 (한 문항씩) ── */}
        {stage === "quiz" && item && (
          <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                {idx + 1} / {TOTAL} · {SUBSCALE_LABEL[item.sub]}
              </span>
              <span>응답 {answeredCount} / {TOTAL}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(answeredCount / TOTAL) * 100}%` }}
              />
            </div>

            <p className="mt-6 min-h-[3.5rem] text-lg font-semibold leading-relaxed text-slate-900">
              <span className="mr-2 text-blue-600">{idx + 1}.</span>
              {item.text}
            </p>

            <div className="mt-5 grid gap-2">
              {VHI_SCALE.map((s) => {
                const selected = answers[idx] === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => answer(s.value)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        selected ? "bg-white text-blue-700" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {s.value}
                    </span>
                    <span className="text-sm font-medium">{s.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={goPrev}
                disabled={idx === 0}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← 이전
              </button>
              <span className="text-xs text-slate-400">키보드 0–4 로 응답</span>
              {allAnswered ? (
                <button
                  onClick={() => setStage("done")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  결과 보기
                </button>
              ) : (
                <span className="w-[72px]" />
              )}
            </div>
          </div>
        )}

        {/* ── 결과 ── */}
        {stage === "done" && (
          <>
            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">VHI 결과</h2>
                <span className="text-xs text-slate-500">
                  {name ? `${name} · ` : ""}응답 {answeredCount} / {TOTAL}
                </span>
              </div>

              {!allAnswered && (
                <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  아직 응답하지 않은 문항이 {TOTAL - answeredCount}개 있습니다
                  (미응답은 0점 처리). 「응답 이어서/수정」으로 마저 응답하세요.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-4">
                <ScoreBox label="신체 P" value={result.p} max={40} accent="rose" />
                <ScoreBox label="기능 F" value={result.f} max={40} accent="blue" />
                <ScoreBox label="정서 E" value={result.e} max={40} accent="violet" />
                <ScoreBox label="총점" value={result.total} max={120} accent="amber" highlight />
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-medium text-slate-600">중증도</p>
                <div className="flex flex-wrap gap-2">
                  {SEV_STEPS.map((s) => (
                    <span
                      key={s}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        s === result.severity
                          ? "bg-rose-600 text-white"
                          : "bg-white text-slate-400 border border-slate-200"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  선별 절단점 ≈ 15점(이상 시 음성장애 의심), 임상적 유의 변화
                  ≈ 18점. 구간(정상 0–14 · 살짝 좋지 않음 15–30 · 좋지 않음
                  31–60 · 심각함 61–120)은 해석 보조용입니다.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => downloadVhiReport(answers, name)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  📄 리포트 다운로드
                </button>
                <button
                  onClick={editFromStart}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  응답 수정
                </button>
                <button
                  onClick={restart}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  처음부터 다시
                </button>
              </div>
            </div>

            {allAnswered && (
              <SaveToHistory
                moduleId="vhi"
                summary={{
                  신체P: result.p,
                  기능F: result.f,
                  정서E: result.e,
                  총점: result.total,
                  중증도: result.severity,
                }}
              />
            )}
          </>
        )}

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            VHI 안내 + 근거
          </summary>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              음성장애지수(Voice Handicap Index)는 음성 문제가 일상·신체·정서에
              미치는 영향을 환자가 스스로 평가하는 30문항 도구입니다. 기능(F)·
              신체(P)·정서(E) 각 10문항, 문항당 0~4점, 총 0~120점이며 점수가
              높을수록 음성장애로 인한 주관적 불편이 큽니다.
            </p>
            <p className="text-xs text-slate-500">
              근거: Jacobson 외 (1997) Am.J.Speech Lang.Pathol. 6:66-70 ·
              김재옥 외 (2007) 음성과학 14:111-125 (한국어 표준화).
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}

function ScoreBox({
  label,
  value,
  max,
  accent,
  highlight,
}: {
  label: string;
  value: number;
  max: number;
  accent: "rose" | "blue" | "violet" | "amber";
  highlight?: boolean;
}) {
  const colors: Record<string, string> = {
    rose: "border-rose-200 bg-rose-50",
    blue: "border-blue-200 bg-blue-50",
    violet: "border-violet-200 bg-violet-50",
    amber: highlight ? "border-amber-400 bg-amber-50" : "border-amber-200 bg-amber-50",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[accent]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value}
        <span className="text-sm font-normal text-slate-400"> / {max}</span>
      </p>
    </div>
  );
}
