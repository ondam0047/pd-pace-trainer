"use client";

import { useMemo } from "react";
import { KOREAN_VOWELS, type VowelGender } from "./koreanVowels";

type Props = {
  f1: number | null;
  f2: number | null;
  gender: VowelGender;
};

const F1_MIN = 200;
const F1_MAX = 1000;
const F2_MIN = 600;
const F2_MAX = 3000;

const PAD = { top: 24, right: 24, bottom: 40, left: 50 };
const W = 440;
const H = 360;

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function freqToX(f2: number): number {
  const inner = W - PAD.left - PAD.right;
  const ratio = (f2 - F2_MIN) / (F2_MAX - F2_MIN);
  return PAD.left + inner * (1 - clamp(ratio, 0, 1));
}

function freqToY(f1: number): number {
  const inner = H - PAD.top - PAD.bottom;
  const ratio = (f1 - F1_MIN) / (F1_MAX - F1_MIN);
  return PAD.top + inner * clamp(ratio, 0, 1);
}

export default function VowelChart({ f1, f2, gender }: Props) {
  const targets = useMemo(
    () =>
      KOREAN_VOWELS.map((v) => ({
        ...v,
        x: freqToX(v.formants[gender].f2),
        y: freqToY(v.formants[gender].f1),
      })),
    [gender],
  );

  const currentPos =
    f1 !== null && f2 !== null ? { x: freqToX(f2), y: freqToY(f1) } : null;

  const f2Ticks = [3000, 2500, 2000, 1500, 1000, 700];
  const f1Ticks = [300, 500, 700, 900];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect
        x={PAD.left}
        y={PAD.top}
        width={W - PAD.left - PAD.right}
        height={H - PAD.top - PAD.bottom}
        fill="#faf9f6"
        stroke="#cbd5e1"
      />

      {f2Ticks.map((f) => {
        const x = freqToX(f);
        return (
          <g key={`gx-${f}`}>
            <line
              x1={x}
              x2={x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#e2e8f0"
              strokeDasharray="2 3"
            />
            <text
              x={x}
              y={H - PAD.bottom + 14}
              fontSize={10}
              fill="#64748b"
              textAnchor="middle"
            >
              {f}
            </text>
          </g>
        );
      })}
      {f1Ticks.map((f) => {
        const y = freqToY(f);
        return (
          <g key={`gy-${f}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="2 3"
            />
            <text
              x={PAD.left - 6}
              y={y + 4}
              fontSize={10}
              fill="#64748b"
              textAnchor="end"
            >
              {f}
            </text>
          </g>
        );
      })}

      <text
        x={W / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={11}
        fill="#475569"
      >
        F2 (Hz) — ← 전설   후설 →
      </text>
      <text
        x={14}
        y={H / 2}
        textAnchor="middle"
        fontSize={11}
        fill="#475569"
        transform={`rotate(-90 14 ${H / 2})`}
      >
        F1 (Hz) — 고모음 ↑   저모음 ↓
      </text>

      {targets.map((t) => (
        <g key={t.hangul}>
          <circle
            cx={t.x}
            cy={t.y}
            r={15}
            fill="#bfdbfe"
            stroke="#3b82f6"
            strokeWidth={1.5}
            opacity={0.75}
          />
          <text
            x={t.x}
            y={t.y + 5}
            textAnchor="middle"
            fontSize={14}
            fill="#1e40af"
            fontWeight={700}
          >
            {t.hangul}
          </text>
        </g>
      ))}

      {currentPos && (
        <g>
          <circle
            cx={currentPos.x}
            cy={currentPos.y}
            r={9}
            fill="#dc2626"
            stroke="white"
            strokeWidth={2}
          />
          <text
            x={currentPos.x}
            y={currentPos.y - 14}
            textAnchor="middle"
            fontSize={10}
            fill="#7f1d1d"
            fontWeight={600}
          >
            현재
          </text>
        </g>
      )}
    </svg>
  );
}
