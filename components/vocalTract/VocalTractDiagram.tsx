"use client";

import { useMemo } from "react";

type Props = {
  f1: number | null;
  f2: number | null;
};

const F1_RANGE: [number, number] = [250, 900];
const F2_RANGE: [number, number] = [700, 2700];

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function normalize(value: number, range: [number, number]): number {
  return (clamp(value, range[0], range[1]) - range[0]) / (range[1] - range[0]);
}

export default function VocalTractDiagram({ f1, f2 }: Props) {
  const tongue = useMemo(() => {
    if (f1 == null || f2 == null) return null;
    const f1n = normalize(f1, F1_RANGE);
    const f2n = normalize(f2, F2_RANGE);
    const x = 200 + 130 * f2n;
    const y = 195 + 105 * f1n;
    return { x, y };
  }, [f1, f2]);

  return (
    <svg viewBox="0 0 400 400" className="w-full">
      <defs>
        <linearGradient id="vt-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde7d3" />
          <stop offset="100%" stopColor="#f3c89f" />
        </linearGradient>
      </defs>

      <path
        d="M 360 110 Q 360 60 300 50 Q 200 40 130 80 Q 80 110 80 180 L 80 280 Q 80 340 120 360 Q 180 380 240 370 Q 290 360 310 340 L 330 320 L 360 310 Z"
        fill="url(#vt-skin)"
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
        d="M 190 175 Q 215 188 230 170"
        fill="#e5b095"
        stroke="#8b5a2b"
        strokeWidth={1.5}
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

      <ellipse cx={350} cy={235} rx={10} ry={8} fill="#d97757" />
      <ellipse cx={355} cy={262} rx={12} ry={9} fill="#c95f3f" />

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
        <g>
          <path
            d={`M 195 322 Q ${tongue.x} ${tongue.y} 338 295 L 338 322 Q ${tongue.x} ${tongue.y + 30} 195 332 Z`}
            fill="#e89999"
            stroke="#a05050"
            strokeWidth={1.5}
          />
          <circle cx={tongue.x} cy={tongue.y} r={5} fill="#a05050" />
          <text
            x={tongue.x + 8}
            y={tongue.y - 6}
            fontSize={12}
            fill="#7a3030"
            fontWeight={600}
          >
            혁 정점
          </text>
        </g>
      ) : (
        <g>
          <path
            d="M 195 322 Q 265 295 338 298 L 338 322 Q 265 326 195 332 Z"
            fill="#e89999"
            opacity={0.4}
          />
          <text
            x={265}
            y={312}
            textAnchor="middle"
            fontSize={13}
            fill="#7a3030"
          >
            발성 대기
          </text>
        </g>
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
