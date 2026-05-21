"use client";

import { MDVP_THRESHOLDS, type VoiceQualityResult } from "./analyzer";

/**
 * MDVP 스타일 방사형(레이더) 다이어그램.
 * 각 파라미터를 방사축에 배치하고, 초록 원 = 정상 임계값(비율 1.0).
 * 환자 값이 원 밖으로 나가면 이상(빨강). KayPENTAX MDVP 그래프와 동일한
 * "정상은 원 안, 병리는 원 밖" 표현.
 */
const PARAMS: { key: keyof typeof MDVP_THRESHOLDS; code: string }[] = [
  { key: "jitaUs", code: "Jita" },
  { key: "jitterLocal", code: "Jitt" },
  { key: "rap", code: "RAP" },
  { key: "ppq5", code: "PPQ" },
  { key: "vF0", code: "vF0" },
  { key: "nhr", code: "NHR" },
  { key: "vAm", code: "vAm" },
  { key: "apq11", code: "APQ" },
  { key: "shdB", code: "ShdB" },
  { key: "shimmerLocal", code: "Shim" },
];

const W = 460;
const H = 380;
const CX = W / 2;
const CY = H / 2;
const R = 130; // 최대 반경 (비율 2.0)
const RING = R / 2; // 임계값 원 (비율 1.0)
const MAX_RATIO = 2;

function pt(ratio: number, angleDeg: number): [number, number] {
  const rr = Math.min(ratio, MAX_RATIO) * RING;
  const a = (angleDeg * Math.PI) / 180;
  return [CX + rr * Math.cos(a), CY + rr * Math.sin(a)];
}

export default function MdvpRadar({ result }: { result: VoiceQualityResult }) {
  const n = PARAMS.length;
  const items = PARAMS.map((p, i) => {
    const angle = -90 + (i * 360) / n;
    const value = result[p.key] as number;
    const thr = MDVP_THRESHOLDS[p.key];
    const ratio = thr > 0 ? value / thr : 0;
    return { ...p, angle, value, thr, ratio };
  });

  const polygon = items
    .map((it) => pt(it.ratio, it.angle).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
      {/* 배경 그리드 원 */}
      {[0.5, 1, 1.5, 2].map((r) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r * RING}
          fill="none"
          stroke="#e2e8f0"
          strokeDasharray={r === 1 ? "0" : "3 3"}
        />
      ))}
      {/* 정상 영역 (임계값 원 안) */}
      <circle cx={CX} cy={CY} r={RING} fill="#dcfce7" opacity={0.5} />
      <circle cx={CX} cy={CY} r={RING} fill="none" stroke="#16a34a" strokeWidth={1.5} />

      {/* 방사축 + 라벨 */}
      {items.map((it) => {
        const [ex, ey] = pt(MAX_RATIO, it.angle);
        const [lx, ly] = pt(MAX_RATIO + 0.32, it.angle);
        return (
          <g key={it.code}>
            <line x1={CX} y1={CY} x2={ex} y2={ey} stroke="#e2e8f0" />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill="#475569"
            >
              {it.code}
            </text>
          </g>
        );
      })}

      {/* 환자 값 폴리곤 */}
      <polygon
        points={polygon}
        fill="#3b82f6"
        fillOpacity={0.15}
        stroke="#2563eb"
        strokeWidth={1.5}
      />
      {items.map((it) => {
        const [x, y] = pt(it.ratio, it.angle);
        const abnormal = it.ratio > 1;
        return (
          <circle
            key={it.code}
            cx={x}
            cy={y}
            r={3.5}
            fill={abnormal ? "#e11d48" : "#16a34a"}
            stroke="#fff"
            strokeWidth={1}
          >
            <title>{`${it.code}: ${it.value.toFixed(2)} (임계 ${it.thr}, ${(it.ratio * 100).toFixed(0)}%)`}</title>
          </circle>
        );
      })}

      {/* 중심 + 임계 라벨 */}
      <text x={CX} y={CY - RING - 4} textAnchor="middle" fontSize={9} fill="#16a34a" fontWeight={700}>
        정상 임계
      </text>
    </svg>
  );
}
