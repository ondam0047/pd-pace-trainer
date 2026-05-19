"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { KOREAN_VOWELS } from "./koreanVowels";
import type { VowelTarget } from "./calibration";

type Props = {
  f1: number | null;
  f2: number | null;
  targets: Record<string, VowelTarget>;
  calibratedSet?: Set<string>;
  onDragTarget?: (hangul: string, f1: number, f2: number) => void;
};

const F1_MIN = 200;
const F1_MAX = 1000;
const F2_MIN = 600;
const F2_MAX = 3000;

const PAD = { top: 30, right: 30, bottom: 50, left: 60 };
const W = 480;
const H = 380;

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function f2ToX(f2: number): number {
  const inner = W - PAD.left - PAD.right;
  const ratio = (f2 - F2_MIN) / (F2_MAX - F2_MIN);
  return PAD.left + inner * (1 - clamp(ratio, 0, 1));
}

function f1ToY(f1: number): number {
  const inner = H - PAD.top - PAD.bottom;
  const ratio = (f1 - F1_MIN) / (F1_MAX - F1_MIN);
  return PAD.top + inner * clamp(ratio, 0, 1);
}

function xToF2(x: number): number {
  const inner = W - PAD.left - PAD.right;
  const ratio = 1 - (x - PAD.left) / inner;
  return F2_MIN + clamp(ratio, 0, 1) * (F2_MAX - F2_MIN);
}

function yToF1(y: number): number {
  const inner = H - PAD.top - PAD.bottom;
  const ratio = (y - PAD.top) / inner;
  return F1_MIN + clamp(ratio, 0, 1) * (F1_MAX - F1_MIN);
}

export default function VowelChart({
  f1,
  f2,
  targets,
  calibratedSet,
  onDragTarget,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingHangul, setDraggingHangul] = useState<string | null>(null);

  const targetsArr = useMemo(
    () =>
      KOREAN_VOWELS.map((v) => {
        const t = targets[v.hangul] ?? v.formants.female;
        return {
          ...v,
          target: t,
          x: f2ToX(t.f2),
          y: f1ToY(t.f1),
          calibrated: calibratedSet?.has(v.hangul) ?? false,
        };
      }),
    [targets, calibratedSet],
  );

  const currentPos =
    f1 !== null && f2 !== null ? { x: f2ToX(f2), y: f1ToY(f1) } : null;

  const updateDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggingHangul || !svgRef.current || !onDragTarget) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const lx = (clientX - rect.left) * scaleX;
      const ly = (clientY - rect.top) * scaleY;
      onDragTarget(draggingHangul, yToF1(ly), xToF2(lx));
    },
    [draggingHangul, onDragTarget],
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) =>
    updateDrag(e.clientX, e.clientY);
  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!draggingHangul) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) updateDrag(t.clientX, t.clientY);
  };
  const endDrag = () => setDraggingHangul(null);

  const f2Ticks = [3000, 2500, 2000, 1500, 1000, 700];
  const f1Ticks = [300, 500, 700, 900];

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchMove={handleTouchMove}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
    >
      <rect
        x={PAD.left}
        y={PAD.top}
        width={W - PAD.left - PAD.right}
        height={H - PAD.top - PAD.bottom}
        fill="#faf9f6"
        stroke="#cbd5e1"
      />

      {f2Ticks.map((f) => {
        const x = f2ToX(f);
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
              y={H - PAD.bottom + 18}
              fontSize={13}
              fill="#475569"
              textAnchor="middle"
            >
              {f}
            </text>
          </g>
        );
      })}
      {f1Ticks.map((f) => {
        const y = f1ToY(f);
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
              x={PAD.left - 8}
              y={y + 5}
              fontSize={13}
              fill="#475569"
              textAnchor="end"
            >
              {f}
            </text>
          </g>
        );
      })}

      <text
        x={W / 2}
        y={H - 8}
        textAnchor="middle"
        fontSize={14}
        fill="#334155"
        fontWeight={500}
      >
        F2 (Hz) — ← 전설   후설 →
      </text>
      <text
        x={18}
        y={H / 2}
        textAnchor="middle"
        fontSize={14}
        fill="#334155"
        fontWeight={500}
        transform={`rotate(-90 18 ${H / 2})`}
      >
        F1 (Hz) — 고모음 ↑   저모음 ↓
      </text>

      {targetsArr.map((t) => {
        const isDragging = draggingHangul === t.hangul;
        return (
          <g
            key={t.hangul}
            style={{ cursor: onDragTarget ? "grab" : "default" }}
            onMouseDown={(e) => {
              if (!onDragTarget) return;
              e.preventDefault();
              setDraggingHangul(t.hangul);
            }}
            onTouchStart={(e) => {
              if (!onDragTarget) return;
              e.preventDefault();
              setDraggingHangul(t.hangul);
            }}
          >
            <circle
              cx={t.x}
              cy={t.y}
              r={18}
              fill={t.calibrated ? "#bbf7d0" : "#bfdbfe"}
              stroke={t.calibrated ? "#15803d" : "#3b82f6"}
              strokeWidth={isDragging ? 3 : 1.5}
              opacity={isDragging ? 0.95 : 0.78}
            />
            <text
              x={t.x}
              y={t.y + 6}
              textAnchor="middle"
              fontSize={18}
              fill={t.calibrated ? "#14532d" : "#1e40af"}
              fontWeight={700}
            >
              {t.hangul}
            </text>
          </g>
        );
      })}

      {currentPos && (
        <g>
          <circle
            cx={currentPos.x}
            cy={currentPos.y}
            r={10}
            fill="#dc2626"
            stroke="white"
            strokeWidth={2.5}
            style={{ transition: "cx 0.12s ease-out, cy 0.12s ease-out" }}
          />
          <text
            x={currentPos.x}
            y={currentPos.y - 16}
            textAnchor="middle"
            fontSize={12}
            fill="#7f1d1d"
            fontWeight={700}
          >
            현재
          </text>
        </g>
      )}
    </svg>
  );
}
