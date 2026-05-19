"use client";

import { useMemo } from "react";

export type ArticulationState = {
  // 혁끓(정점) 위치 — SVG 좌표계 (기본 viewBox 480x480)
  tongueTip?: { x: number; y: number };
  // 혁목 (dorsum) 위치
  tongueBody?: { x: number; y: number };
  // 연구개 상태 — true = 하강(비음·코로 공기), false = 상단 착구(구강음)
  velumOpen?: boolean;
  // 입술 폐쇄
  lipClosure?: boolean;
  // 입술 원순성 0–1
  lipRounding?: number;
  // 협착점 하이라이트 (마찰음·파열음의 접촉 지점)
  highlight?: { x: number; y: number; label?: string; color?: string };
  // 설측음(/ス/)처럼 혀 양쪽으로 공기가 흐르는 표시
  lateralAirflow?: boolean;
};

const DEFAULT_TIP = { x: 370, y: 285 };
const DEFAULT_BODY = { x: 320, y: 280 };

function tonguePath(
  tip: { x: number; y: number },
  body: { x: number; y: number },
): string {
  // 상면: 혁끓 → 혁날 → 혁목 → 혁뿌리
  // 하면: 하악변 안쪽을 따라서 다시 혁끓로
  return `
    M ${tip.x} ${tip.y}
    Q ${tip.x - 18} ${tip.y - 8} ${body.x + 22} ${body.y - 6}
    Q ${body.x + 2} ${body.y - 20} ${body.x - 22} ${body.y - 6}
    Q ${body.x - 50} ${body.y + 14} ${body.x - 56} ${body.y + 42}
    L 230 358
    Q 270 368 318 360
    Q 350 352 ${tip.x + 2} ${tip.y + 11}
    Z
  `.trim();
}

function velumPath(open: boolean): string {
  if (open) {
    // 하강 — 끌롤 연구개가 코구명으로 공기 파솤 열림
    return "M 305 228 Q 312 250 312 268 Q 308 275 304 268 Q 302 248 298 230 Z";
  }
  // 상승 — 인두 뒤벽에 착근해 구강음 경로만 열림
  return "M 305 228 Q 290 225 280 232 Q 278 240 282 246 Q 295 240 308 232 Z";
}

function lipPaths(closure: boolean, rounding: number) {
  // 원순성은 입술 세로 폭 확장으로 표현
  const r = Math.max(0, Math.min(1, rounding));
  const upperRy = closure ? 7 : 4 + r * 3;
  const lowerRy = closure ? 7 : 5 + r * 3;
  const upperCy = closure ? 268 : 260;
  const lowerCy = closure ? 274 : 282;
  return {
    upper: { cx: 420, cy: upperCy, rx: 10, ry: upperRy },
    lower: { cx: 422, cy: lowerCy, rx: 11, ry: lowerRy },
  };
}

export default function AnatomicalDiagram({
  state,
  showLabels = true,
}: {
  state?: ArticulationState;
  showLabels?: boolean;
}) {
  const tip = state?.tongueTip ?? DEFAULT_TIP;
  const body = state?.tongueBody ?? DEFAULT_BODY;
  const velumOpen = state?.velumOpen ?? false;
  const lipClosure = state?.lipClosure ?? false;
  const lipRound = state?.lipRounding ?? 0;
  const highlight = state?.highlight;
  const lateral = state?.lateralAirflow ?? false;

  const tongueD = useMemo(() => tonguePath(tip, body), [tip, body]);
  const velumD = useMemo(() => velumPath(velumOpen), [velumOpen]);
  const lips = useMemo(
    () => lipPaths(lipClosure, lipRound),
    [lipClosure, lipRound],
  );

  return (
    <svg viewBox="0 0 480 480" className="w-full">
      <defs>
        <linearGradient id="skinGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef0dd" />
          <stop offset="100%" stopColor="#f0c599" />
        </linearGradient>
        <linearGradient id="tongueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4a8a8" />
          <stop offset="100%" stopColor="#c47373" />
        </linearGradient>
        <radialGradient id="oralCavity" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="#5a3030" />
          <stop offset="100%" stopColor="#3a1a1a" />
        </radialGradient>
      </defs>

      {/* 머리 외곽 솤곡 */}
      <path
        d="M 85 240 Q 65 145 130 75 Q 215 30 305 45 Q 365 55 388 100 Q 398 130 388 165 L 392 178 Q 418 195 432 228 L 430 244 Q 420 254 408 254 L 405 260 L 402 270 Q 400 278 402 285 L 398 295 Q 392 308 384 312 L 372 322 Q 355 338 332 348 Q 280 372 220 365 L 130 395 L 85 395 Z"
        fill="url(#skinGrad)"
        stroke="#a67042"
        strokeWidth={1.5}
      />

      {/* 머리카락 */}
      <path
        d="M 85 240 Q 65 145 130 75 Q 215 30 305 45 Q 365 55 388 100 L 380 130 Q 320 95 240 100 Q 165 110 125 150 Q 95 195 90 245 Z"
        fill="#5a3a26"
        opacity={0.85}
      />

      {/* 눌 (장식용) */}
      <ellipse cx={325} cy={170} rx={11} ry={6} fill="#fff" stroke="#a67042" />
      <circle cx={325} cy={170} r={4} fill="#5a3a26" />
      <path d="M 314 160 Q 325 154 340 160" fill="none" stroke="#5a3a26" strokeWidth={2} strokeLinecap="round" />

      {/* 코 외곽 */}
      <path d="M 388 175 Q 410 192 425 220" fill="none" stroke="#a67042" strokeWidth={1.5} />
      {/* 콧구멃 */}
      <ellipse cx={415} cy={242} rx={4} ry={2.5} fill="#7a4a2a" />

      {/* 구강 내부 어두운 배경 */}
      <path
        d="M 230 230 L 230 360 Q 240 365 270 365 Q 320 368 360 358 L 405 285 L 408 260 L 380 245 L 305 228 L 245 222 Z"
        fill="url(#oralCavity)"
        opacity={0.75}
      />

      {/* 비강(코의 뒤공간) — velum 열릴 때 연결됨 */}
      <path
        d="M 305 220 Q 320 200 360 195 L 388 195 L 388 215 Q 350 218 305 226 Z"
        fill="#5a3030"
        opacity={velumOpen ? 0.7 : 0.15}
        style={{ transition: "opacity 0.25s ease-out" }}
      />

      {/* 경구개 (hard palate) */}
      <path
        d="M 310 230 Q 348 220 380 232 L 382 240 Q 348 230 310 238 Z"
        fill="#e8b8a0"
        stroke="#a67042"
        strokeWidth={1}
      />

      {/* 연구개 (velum) — 동적 */}
      <g style={{ transition: "opacity 0.25s ease-out" }}>
        <path d={velumD} fill="#d89090" stroke="#a05050" strokeWidth={1.2} />
        {/* 목젠 (uvula) */}
        {velumOpen ? (
          <ellipse cx={310} cy={272} rx={3} ry={5} fill="#c87878" />
        ) : (
          <ellipse cx={283} cy={248} rx={3} ry={4} fill="#c87878" />
        )}
      </g>

      {/* 인두 뒤벽 */}
      <line
        x1={245}
        y1={228}
        x2={235}
        y2={358}
        stroke="#a67042"
        strokeWidth={2}
        strokeDasharray="4 3"
      />

      {/* 윗니 (incisor + canine + premolar 3개) */}
      <g>
        {[378, 372, 365, 357].map((x) => (
          <rect
            key={`ut-${x}`}
            x={x}
            y={239}
            width={5}
            height={11}
            fill="#fff"
            stroke="#bdbdbd"
            strokeWidth={0.7}
            rx={1}
          />
        ))}
      </g>

      {/* 아래니 */}
      <g>
        {[378, 372, 365, 357].map((x) => (
          <rect
            key={`lt-${x}`}
            x={x}
            y={280}
            width={5}
            height={10}
            fill="#fff"
            stroke="#bdbdbd"
            strokeWidth={0.7}
            rx={1}
          />
        ))}
      </g>

      {/* 하악 윤곽 (mandible) */}
      <path
        d="M 230 358 Q 270 372 318 366 Q 350 360 380 348 L 386 332 Q 395 322 392 308 L 385 298"
        fill="none"
        stroke="#a67042"
        strokeWidth={2}
      />

      {/* 혁 */}
      <path
        d={tongueD}
        fill="url(#tongueGrad)"
        stroke="#a05050"
        strokeWidth={1.5}
        style={{ transition: "d 0.18s ease-out" }}
      />
      {/* 혁 정점 마커 */}
      <circle cx={tip.x} cy={tip.y} r={3.5} fill="#7a3030" />

      {/* 설측음(/l/) 때 혁 양옥으로 공기 흐름 표시 */}
      {lateral && (
        <g>
          <path d="M 350 295 Q 360 285 372 292" fill="none" stroke="#7dd3fc" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M 350 305 Q 360 315 372 308" fill="none" stroke="#7dd3fc" strokeWidth={2.5} strokeLinecap="round" />
          <text x={360} y={335} fontSize={11} fill="#0369a1" textAnchor="middle" fontWeight={600}>← 혁 양옥으로 공기</text>
        </g>
      )}

      {/* 입술 */}
      <ellipse
        cx={lips.upper.cx}
        cy={lips.upper.cy}
        rx={lips.upper.rx}
        ry={lips.upper.ry}
        fill="#d97757"
        style={{ transition: "cy 0.2s, ry 0.2s" }}
      />
      <ellipse
        cx={lips.lower.cx}
        cy={lips.lower.cy}
        rx={lips.lower.rx}
        ry={lips.lower.ry}
        fill="#c95f3f"
        style={{ transition: "cy 0.2s, ry 0.2s" }}
      />

      {/* 후두덞개 (epiglottis) — 작은 뜨개 */}
      <path
        d="M 232 358 Q 228 348 232 340 Q 240 342 238 358 Z"
        fill="#d89090"
        stroke="#a05050"
        strokeWidth={0.8}
      />

      {/* 후두 (larynx) */}
      <ellipse cx={225} cy={385} rx={22} ry={18} fill="#fed8b8" stroke="#a05050" strokeWidth={1.5} />
      {/* 성대 표시 */}
      <line x1={210} y1={385} x2={240} y2={385} stroke="#a05050" strokeWidth={1.2} />

      {/* 기관 (trachea) */}
      <path
        d="M 210 400 Q 208 425 212 460 M 240 400 Q 242 425 238 460"
        fill="none"
        stroke="#a67042"
        strokeWidth={1.5}
      />
      {[412, 426, 440, 454].map((y) => (
        <line
          key={`tr-${y}`}
          x1={211}
          y1={y}
          x2={239}
          y2={y}
          stroke="#c89060"
          strokeWidth={0.8}
        />
      ))}

      {/* 하이라이트 — 조음 접촉점 */}
      {highlight && (
        <g>
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r={12}
            fill={highlight.color ?? "#facc15"}
            opacity={0.45}
          />
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r={5}
            fill={highlight.color ?? "#eab308"}
          />
          {highlight.label && (
            <text
              x={highlight.x}
              y={highlight.y - 18}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#854d0e"
            >
              {highlight.label}
            </text>
          )}
        </g>
      )}

      {/* 라벨 */}
      {showLabels && (
        <g fontSize={11} fill="#5a3a26" fontWeight={500}>
          <text x={340} y={222} textAnchor="middle">경구개</text>
          <text x={290} y={210} textAnchor="middle">연구개</text>
          <text x={252} y={285} textAnchor="end">인두</text>
          <text x={195} y={385} textAnchor="end">후두</text>
          <text x={195} y={345} textAnchor="end">후두덞개</text>
          <text x={195} y={430} textAnchor="end">기관</text>
          <text x={442} y={268} textAnchor="start">입술</text>
          <text x={395} y={232} textAnchor="start" fontSize={10}>윗니</text>
          <text x={395} y={302} textAnchor="start" fontSize={10}>아랫니</text>
          <text x={tip.x + 10} y={tip.y + 4} fontSize={10} fill="#7a3030" fontWeight={700}>혁끓</text>
          <text x={body.x - 18} y={body.y - 15} fontSize={10} fill="#7a3030" fontWeight={700}>혁목</text>
        </g>
      )}
    </svg>
  );
}
