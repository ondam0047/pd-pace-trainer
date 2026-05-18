"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  KOREAN_CONSONANTS,
  consonantsByPlace,
  type KoreanConsonant,
} from "./vocalTract/koreanConsonants";

const PLACE_ORDER = ["양순", "치조", "경구개", "연구개", "성문"] as const;

function ConsonantDiagram({
  consonant,
}: {
  consonant: KoreanConsonant | null;
}) {
  const lipClosed = consonant?.lipClosure ?? false;
  const velarUp = consonant?.velarOcclusion ?? false;
  const tongue = consonant?.tongueTarget ?? null;

  return (
    <svg viewBox="0 0 400 400" className="w-full">
      <defs>
        <linearGradient id="c-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde7d3" />
          <stop offset="100%" stopColor="#f3c89f" />
        </linearGradient>
      </defs>

      <path
        d="M 360 110 Q 360 60 300 50 Q 200 40 130 80 Q 80 110 80 180 L 80 280 Q 80 340 120 360 Q 180 380 240 370 Q 290 360 310 340 L 330 320 L 360 310 Z"
        fill="url(#c-skin)"
        stroke="#b78250"
        strokeWidth={2}
      />

      <path
        d="M 230 170 Q 280 165 340 178"
        fill="none"
        stroke="#8b5a2b"
        strokeWidth={3}
        strokeLinecap="round"
      />

      <path
        d={
          velarUp
            ? "M 190 175 Q 215 170 230 170"
            : "M 190 175 Q 215 188 230 170"
        }
        fill="#e5b095"
        stroke="#8b5a2b"
        strokeWidth={1.5}
        style={{ transition: "d 0.25s ease-out" }}
      />

      <line
        x1={185}
        y1={170}
        x2={185}
        y2={320}
        stroke="#b78250"
        strokeWidth={2}
        strokeDasharray="4 3"
      />

      {/* lips - animated closure */}
      <ellipse
        cx={350}
        cy={lipClosed ? 248 : 235}
        rx={10}
        ry={lipClosed ? 12 : 8}
        fill="#d97757"
        style={{ transition: "cy 0.25s ease-out, ry 0.25s ease-out" }}
      />
      <ellipse
        cx={355}
        cy={lipClosed ? 252 : 262}
        rx={12}
        ry={lipClosed ? 12 : 9}
        fill="#c95f3f"
        style={{ transition: "cy 0.25s ease-out, ry 0.25s ease-out" }}
      />

      <path
        d="M 200 320 Q 270 342 340 322"
        fill="none"
        stroke="#b78250"
        strokeWidth={2}
      />

      <ellipse
        cx={180}
        cy={335}
        rx={18}
        ry={14}
        fill="#fed8b8"
        stroke="#b78250"
        strokeWidth={1.5}
      />
      <text x={180} y={362} textAnchor="middle" fontSize={11} fill="#8b5a2b">
        후두
      </text>

      {tongue ? (
        <g style={{ transition: "all 0.3s ease-out" }}>
          <path
            d={`M 195 322 Q ${tongue.x} ${tongue.y} 338 295 L 338 322 Q ${tongue.x} ${tongue.y + 28} 195 332 Z`}
            fill="#e89999"
            stroke="#a05050"
            strokeWidth={1.5}
          />
          <circle cx={tongue.x} cy={tongue.y} r={6} fill="#a05050" />
        </g>
      ) : (
        <path
          d="M 195 322 Q 265 295 338 298 L 338 322 Q 265 326 195 332 Z"
          fill="#e89999"
          opacity={0.7}
        />
      )}

      <text x={290} y={158} fontSize={12} fill="#6b4226" fontWeight={500}>
        경구개
      </text>
      <text x={195} y={158} fontSize={12} fill="#6b4226" fontWeight={500}>
        연구개
      </text>
      <text x={360} y={222} fontSize={12} fill="#6b4226" fontWeight={500}>
        입술
      </text>
      <text x={170} y={250} fontSize={12} fill="#6b4226" textAnchor="end" fontWeight={500}>
        인두
      </text>
    </svg>
  );
}

export default function ConsonantTrainer() {
  const [selected, setSelected] = useState<KoreanConsonant | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoIndexRef = useRef(0);
  const autoTimerRef = useRef<number | null>(null);

  const groups = useMemo(() => consonantsByPlace(), []);

  useEffect(() => {
    if (!autoPlay) {
      if (autoTimerRef.current !== null) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }
    autoTimerRef.current = window.setInterval(() => {
      const i = autoIndexRef.current % KOREAN_CONSONANTS.length;
      setSelected(KOREAN_CONSONANTS[i]);
      autoIndexRef.current = i + 1;
    }, 1800);
    return () => {
      if (autoTimerRef.current !== null) clearInterval(autoTimerRef.current);
    };
  }, [autoPlay]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              자음 학습 모드
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              버튼을 누르면 해당 자음의 조음 위치에 혀·입술·연구개 위치가
              맞춰집니다. 치조마찰음·경구개 변별이 어려운 아동에게 시각적
              모형 학습으로 사용하세요.
            </p>
          </div>
          <button
            onClick={() => setAutoPlay((v) => !v)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              autoPlay
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {autoPlay ? "자동 순회 정지" : "자동 순회 재생"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-[360px]">
            <ConsonantDiagram consonant={selected} />
          </div>
          {selected ? (
            <div className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
              <p className="text-lg font-bold">
                {selected.hangul}{" "}
                <span className="text-base font-medium">
                  /{selected.ipa}/
                </span>
              </p>
              <p className="mt-1 text-xs font-medium text-violet-700">
                {selected.place} · {selected.manner}
              </p>
              <p className="mt-2 text-xs text-violet-800">
                {selected.description}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              오른쪽에서 자음을 선택하세요.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700">자음 선택</h4>
          <div className="mt-3 space-y-3">
            {PLACE_ORDER.map((place) => (
              <div key={place}>
                <p className="text-xs font-medium text-slate-500">{place}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {groups[place]?.map((c) => (
                    <button
                      key={c.hangul}
                      onClick={() => {
                        setSelected(c);
                        setAutoPlay(false);
                      }}
                      className={`min-w-12 rounded-lg border px-3 py-2 text-base font-bold transition ${
                        selected?.hangul === c.hangul
                          ? "border-violet-500 bg-violet-100 text-violet-900"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c.hangul}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            조음 위치 근거: 이호영(1996), 신지영(2014), 극단적 경우에는 개인
            편차 존재. 그림은 표준 모형으로 교육·임상 점검용으로 사용.
          </p>
        </div>
      </div>
    </div>
  );
}
