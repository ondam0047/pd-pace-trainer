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

// 참고 차트 범위 일치: F1 0–800, F2 0–3000 (F2 우→좌 역순)
const F1_MIN = 0;
const F1_MAX = 800;
const F2_MIN = 0;
const F2_MAX = 3000;

const PAD = { top: 36, right: 30, bottom: 52, left: 70 };
const W = 540;
const H = 420;

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function f2ToX(f2: number): number {
  const inner = W - PAD.left - PAD.right;
  const ratio = (f2 - F2_MIN) / (F2_MAX - F2_MIN);
  // F2 역순: 세로한 F2가 왼쪽
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

  // 참고 이미지에 맞춘 눈금
  const f2Ticks = [3000, 2500, 2000, 1500, 1000, 500];
  const f1Ticks = [0, 100, 200, 300, 400, 500, 600, 700, 800];

  // 메이저 그리드 (100Hz) — 참고 이미지처럼 촉촉한 그리드
  const minorF2 = [];
  for (let f = 0; f <= 3000; f += 100) minorF2.push(f);
  const minorF1 = [];
  for (let f = 0; f <= 800; f += 50) minorF1.push(f);

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
      {/* 차트 배경 */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={W - PAD.left - PAD.right}
        height={H - PAD.top - PAD.bottom}
        fill="#fdfdfb"
        stroke="#94a3b8"
        strokeWidth="1.5"
      />

      {/* 메이저 그리드 (100Hz F2, 50Hz F1) — 참고 이미지의 계울테림 */}
      {minorF2.map((f) => {
        const x = f2ToX(f);
        return (
          <line
            key={`mf2-${f}`}
            x1={x}
            x2={x}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        );
      })}
      {minorF1.map((f) => {
        const y = f1ToY(f);
        return (
          <line
            key={`mf1-${f}`}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        );
      })}

      {/* 메이저 그리드 (500Hz F2, 100Hz F1) */}
      {f2Ticks.map((f) => {
        const x = f2ToX(f);
        return (
          <g key={`gx-${f}`}>
            <line
              x1={x}
              x2={x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <text
              x={x}
              y={PAD.top - 10}
              fontSize="13"
              fill="#334155"
              textAnchor="middle"
              fontWeight="500"
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
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <text
              x={W - PAD.right + 10}
              y={y + 4}
              fontSize="13"
              fill="#334155"
              textAnchor="start"
              fontWeight="500"
            >
              {f}
            </text>
          </g>
        );
      })}

      {/* 축 제목 — 참고 이미지와 동일하게 상단 F2, 우측 F1 */}
      <text
        x={W / 2}
        y={16}
        textAnchor="middle"
        fontSize="15"
        fill="#0f172a"
        fontWeight="700"
      >
        F2
      </text>
      <text
        x={W - 18}
        y={H / 2}
        textAnchor="middle"
        fontSize="15"
        fill="#0f172a"
        fontWeight="700"
        transform={`rotate(-90 ${W - 18} ${H / 2})`}
      >
        F1
      </text>
      <text
        x={W / 2}
        y={H - 8}
        textAnchor="middle"
        fontSize="11"
        fill="#64748b"
      >
        ← 전설   후설 →   (역순)
      </text>

      {/* 모음 타겟 — 파란·녹색 원 + 한글 + IPA */}
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
              r="7"
              fill={t.calibrated ? "#22c55e" : "#3b82f6"}
              stroke="white"
              strokeWidth={isDragging ? "3" : "2"}
              opacity={isDragging ? "1" : "0.9"}
            />
            <text
              x={t.x}
              y={t.y - 12}
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill={t.calibrated ? "#14532d" : "#1e3a8a"}
            >
              {t.hangul}
            </text>
            <text
              x={t.x + 12}
              y={t.y + 5}
              fontSize="11"
              fontStyle="italic"
              fill="#64748b"
            >
              {t.ipa}
            </text>
          </g>
        );
      })}

      {/* 현재 발성 위치 */}
      {currentPos && (
        <g>
          <circle
            cx={currentPos.x}
            cy={currentPos.y}
            r="11"
            fill="#dc2626"
            stroke="white"
            strokeWidth="3"
            style={{
              transition: "cx 0.12s ease-out, cy 0.12s ease-out",
            }}
          />
          <text
            x={currentPos.x}
            y={currentPos.y - 18}
            textAnchor="middle"
            fontSize="12"
            fill="#7f1d1d"
            fontWeight="700"
          >
            현재
          </text>
        </g>
      )}
    </svg>
  );
}
