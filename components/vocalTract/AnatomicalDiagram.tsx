"use client";

import { useMemo } from "react";

export type AirflowType =
  | "none"
  | "plosive_burst"
  | "fricative_oral"
  | "nasal"
  | "lateral"
  | "flap"
  | "blocked";

export type ArticulationState = {
  tongueTip?: { x: number; y: number };
  tongueBody?: { x: number; y: number };
  velumOpen?: boolean;
  lipClosure?: boolean;
  lipRounding?: number;
  highlight?: { x: number; y: number; label?: string; color?: string };
  airflow?: AirflowType;
};

// viewBox 0 0 580 720 기준
const DEFAULT_TIP = { x: 440, y: 358 };
const DEFAULT_BODY = { x: 380, y: 355 };

function tonguePath(
  tip: { x: number; y: number },
  body: { x: number; y: number },
): string {
  return `M ${tip.x} ${tip.y} Q ${tip.x - 22} ${tip.y - 14} ${body.x + 32} ${body.y - 10} Q ${body.x + 4} ${body.y - 30} ${body.x - 32} ${body.y - 5} Q ${body.x - 68} ${body.y + 25} ${body.x - 82} ${body.y + 58} L 270 442 Q 322 460 380 452 Q 412 445 ${tip.x + 4} ${tip.y + 20} Z`;
}

function velumPath(open: boolean): string {
  return open
    ? "M 310 295 Q 318 348 305 386 Q 295 388 298 378 Q 305 348 305 305 Z"
    : "M 310 295 Q 290 290 275 305 Q 272 320 280 324 Q 300 318 320 310 Z";
}

function lipShape(closure: boolean, rounding: number) {
  const r = Math.max(0, Math.min(1, rounding));
  return {
    upper: {
      cx: 466,
      cy: closure ? 358 : 346,
      rx: 12 - r * 3,
      ry: closure ? 8 : 5 + r * 3,
    },
    lower: {
      cx: 468,
      cy: closure ? 365 : 378,
      rx: 13 - r * 3,
      ry: closure ? 8 : 6 + r * 3,
    },
  };
}

// ====== 공기 흐름 애니메이션 오버레이 ======
function AirflowOverlay({ type }: { type: AirflowType }) {
  if (type === "none" || type === "blocked") return null;

  if (type === "plosive_burst") {
    return (
      <g>
        {[0, 0.25, 0.5].map((b) => (
          <circle
            key={b}
            cx="470"
            cy="360"
            r="0"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            opacity="0"
          >
            <animate
              attributeName="r"
              from="4"
              to="45"
              dur="0.75s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.75;0"
              dur="0.75s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <text x="495" y="395" fontSize="11" fill="#0369a1" fontWeight="600">
          폭발장
        </text>
      </g>
    );
  }

  if (type === "fricative_oral") {
    return (
      <g>
        {[0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72].map((b) => (
          <circle key={b} r="3" fill="#38bdf8" opacity="0">
            <animate
              attributeName="cx"
              values="395;490"
              dur="0.85s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="340;355"
              dur="0.85s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.8;0.8;0"
              keyTimes="0;0.15;0.85;1"
              dur="0.85s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <text x="495" y="395" fontSize="11" fill="#0369a1" fontWeight="600">
          좋은 마찰 통로
        </text>
      </g>
    );
  }

  if (type === "nasal") {
    return (
      <g>
        {[0, 0.3, 0.6, 0.9].map((b) => (
          <circle key={b} r="3" fill="#7dd3fc" opacity="0">
            <animate
              attributeName="cx"
              values="320;350;390;430;460"
              dur="1.5s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="345;280;230;240;293"
              dur="1.5s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.75;0.75;0.75;0"
              keyTimes="0;0.1;0.5;0.9;1"
              dur="1.5s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <text x="480" y="325" fontSize="11" fill="#0369a1" fontWeight="600">
          코로 공기
        </text>
      </g>
    );
  }

  if (type === "lateral") {
    return (
      <g>
        {[0, 0.15, 0.3, 0.45].map((b) => (
          <g key={b}>
            <circle r="2.5" fill="#7dd3fc" opacity="0">
              <animate
                attributeName="cx"
                values="400;475"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values="343;323"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.8;0.8;0"
                keyTimes="0;0.15;0.85;1"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle r="2.5" fill="#7dd3fc" opacity="0">
              <animate
                attributeName="cx"
                values="400;475"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values="365;388"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.8;0.8;0"
                keyTimes="0;0.15;0.85;1"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
        <text x="495" y="325" fontSize="11" fill="#0369a1" fontWeight="600">
          혁 양옥으로
        </text>
        <text x="495" y="395" fontSize="11" fill="#0369a1" fontWeight="600">
          공기 새어나감
        </text>
      </g>
    );
  }

  if (type === "flap") {
    return (
      <g>
        <circle cx="445" cy="335" r="0" fill="#fca5a5">
          <animate
            attributeName="r"
            values="3;8;3;8;3"
            dur="0.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.3;0.95;0.3;0.95;0.3"
            dur="0.4s"
            repeatCount="indefinite"
          />
        </circle>
        <text x="460" y="320" fontSize="11" fill="#b91c1c" fontWeight="600">
          알게 쳤다 떨어짐 (탄설음)
        </text>
      </g>
    );
  }

  return null;
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
  const airflow = state?.airflow ?? "none";

  const tongueD = useMemo(() => tonguePath(tip, body), [tip, body]);
  const velumD = useMemo(() => velumPath(velumOpen), [velumOpen]);
  const lips = useMemo(
    () => lipShape(lipClosure, lipRound),
    [lipClosure, lipRound],
  );

  return (
    <svg viewBox="0 0 580 720" className="w-full">
      <defs>
        <linearGradient id="vt-skinGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fce5ce" />
          <stop offset="100%" stopColor="#eebd97" />
        </linearGradient>
        <linearGradient id="vt-tongueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e5a5a5" />
          <stop offset="100%" stopColor="#b66767" />
        </linearGradient>
        <radialGradient id="vt-oralDark" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#5c2828" />
          <stop offset="100%" stopColor="#341212" />
        </radialGradient>
        <linearGradient id="vt-boneGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f5e6c5" />
          <stop offset="100%" stopColor="#e0c896" />
        </linearGradient>
        <linearGradient id="vt-palateGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3c2a0" />
          <stop offset="100%" stopColor="#dc9c75" />
        </linearGradient>
      </defs>

      {/* 경추 (툫명으로 뒤쪽) */}
      <g stroke="#b8884e" strokeWidth="1.4" fill="url(#vt-boneGrad)">
        <path d="M 60 235 L 145 240 L 152 300 L 65 295 Z" />
        <path d="M 65 312 L 154 315 L 160 375 L 70 370 Z" />
        <path d="M 70 386 L 162 388 L 168 448 L 75 444 Z" />
        <path d="M 75 460 L 170 462 L 176 522 L 80 518 Z" />
      </g>

      {/* 외곽 피부 라인 */}
      <path
        d="M 95 235 Q 75 130 150 75 Q 240 35 320 55 Q 380 70 405 122 Q 415 158 408 198 L 415 222 Q 445 238 472 282 L 472 308 Q 458 322 442 322 L 432 335 L 428 350 L 426 362 L 428 374 L 432 386 L 430 398 L 422 412 L 408 432 Q 382 458 352 462 Q 280 470 218 462 L 185 472 Q 172 510 182 545 L 192 580 Q 202 645 215 720 L 95 720 Z"
        fill="url(#vt-skinGrad)"
        stroke="#a06832"
        strokeWidth="1.5"
      />

      {/* 머리카락 */}
      <path
        d="M 95 235 Q 75 130 150 75 Q 240 35 320 55 Q 380 70 405 122 L 395 148 Q 320 112 235 118 Q 165 128 132 168 Q 95 215 100 248 Z"
        fill="#5a3a26"
        opacity="0.88"
      />

      {/* 눌 (장식용) */}
      <ellipse cx="352" cy="180" rx="15" ry="7" fill="#fff" stroke="#a06832" strokeWidth="1.2" />
      <circle cx="352" cy="180" r="4.5" fill="#5a3a26" />
      <path d="M 336 168 Q 354 162 372 168" stroke="#5a3a26" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* 코 외곽 라인 */}
      <path d="M 405 196 Q 435 218 468 275" stroke="#a06832" strokeWidth="1.5" fill="none" />

      {/* 콧구멃 */}
      <ellipse cx="455" cy="295" rx="6" ry="3.5" fill="#5a2828" />

      {/* 비강+구강 내부 어두운 배경 */}
      <path
        d="M 268 198 L 415 235 L 442 295 L 432 312 L 418 315 L 418 340 Q 376 365 318 388 L 268 442 Z"
        fill="url(#vt-oralDark)"
        opacity="0.85"
      />

      {/* 비강 내 코덞개(turbinates) 3개 */}
      <g fill="#cc7878" stroke="#a05050" strokeWidth="1">
        <path d="M 280 165 Q 360 162 410 195 Q 395 207 348 200 Q 300 195 280 182 Z" opacity="0.85" />
        <path d="M 285 215 Q 370 212 418 238 Q 402 252 350 247 Q 302 242 290 230 Z" opacity="0.9" />
        <path d="M 275 253 Q 355 250 418 268 Q 405 282 345 282 Q 290 280 268 270 Z" opacity="0.85" />
      </g>

      {/* 경구개 (hard palate) */}
      <path
        d="M 442 308 Q 380 290 312 300 L 310 312 Q 380 300 440 318 Z"
        fill="url(#vt-palateGrad)"
        stroke="#a06832"
        strokeWidth="1.2"
      />

      {/* 연구개 (동적) */}
      <path
        d={velumD}
        fill="#d27878"
        stroke="#a05050"
        strokeWidth="1.2"
        style={{ transition: "d 0.3s ease-out" }}
      />

      {/* 목젠 */}
      {velumOpen ? (
        <ellipse cx="302" cy="393" rx="3.5" ry="7" fill="#c47070" style={{ transition: "all 0.3s" }} />
      ) : (
        <ellipse cx="277" cy="322" rx="3.5" ry="5" fill="#c47070" style={{ transition: "all 0.3s" }} />
      )}

      {/* 인두 뒤벽 */}
      <line
        x1="263"
        y1="192"
        x2="252"
        y2="452"
        stroke="#a06832"
        strokeWidth="2"
        strokeDasharray="4 3"
      />

      {/* 윗니 */}
      {[440, 432, 423, 412].map((x, i) => (
        <rect
          key={`ut-${i}`}
          x={x}
          y="315"
          width="7"
          height="14"
          fill="#fff"
          stroke="#aaa"
          strokeWidth="0.7"
          rx="1.5"
        />
      ))}

      {/* 아랫니 — 입 열릴 때만 */}
      {!lipClosure &&
        [440, 432, 423, 412].map((x, i) => (
          <rect
            key={`lt-${i}`}
            x={x}
            y="368"
            width="7"
            height="14"
            fill="#fff"
            stroke="#aaa"
            strokeWidth="0.7"
            rx="1.5"
          />
        ))}

      {/* 하악 (mandible) 끌 선 */}
      <path
        d="M 268 442 Q 320 460 380 455 Q 412 450 425 432 L 432 410 Q 437 395 432 380"
        fill="none"
        stroke="#b8884e"
        strokeWidth="3.5"
      />

      {/* 혁 (동적) */}
      <g>
        {airflow === "flap" && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -8; 0 0"
            dur="0.35s"
            repeatCount="indefinite"
          />
        )}
        <path
          d={tongueD}
          fill="url(#vt-tongueGrad)"
          stroke="#a05050"
          strokeWidth="1.5"
          style={{ transition: "d 0.25s ease-out" }}
        />
        <circle cx={tip.x} cy={tip.y} r="4" fill="#7e3030" style={{ transition: "cx 0.25s ease-out, cy 0.25s ease-out" }} />
      </g>

      {/* 입술 (동적) */}
      <ellipse
        cx={lips.upper.cx}
        cy={lips.upper.cy}
        rx={lips.upper.rx}
        ry={lips.upper.ry}
        fill="#d97757"
        style={{ transition: "cx 0.3s, cy 0.3s, rx 0.3s, ry 0.3s" }}
      />
      <ellipse
        cx={lips.lower.cx}
        cy={lips.lower.cy}
        rx={lips.lower.rx}
        ry={lips.lower.ry}
        fill="#c95f3f"
        style={{ transition: "cx 0.3s, cy 0.3s, rx 0.3s, ry 0.3s" }}
      />

      {/* 설골 (hyoid bone) */}
      <ellipse cx="268" cy="480" rx="24" ry="6" fill="url(#vt-boneGrad)" stroke="#b8884e" strokeWidth="1.2" />

      {/* 후두덞개 (epiglottis) */}
      <path
        d="M 258 495 Q 248 482 256 468 Q 270 472 266 495 Z"
        fill="#e0a0a0"
        stroke="#a05050"
        strokeWidth="1"
      />

      {/* 후두 (larynx) */}
      <ellipse cx="232" cy="522" rx="33" ry="23" fill="#f0d8c8" stroke="#a05050" strokeWidth="1.5" />

      {/* 성대 */}
      <line x1="210" y1="522" x2="254" y2="522" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="222" y1="522" x2="242" y2="522" stroke="#a05050" strokeWidth="1.5" />

      {/* 기관 (trachea) */}
      <path d="M 213 548 L 211 720 M 252 548 L 254 720" stroke="#a06832" strokeWidth="2" fill="none" />
      {[568, 590, 612, 634, 656, 678, 700].map((y) => (
        <line
          key={`tr-${y}`}
          x1="213"
          y1={y}
          x2="252"
          y2={y}
          stroke="#d08868"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}

      {/* 하이라이트 (조음 접촉점) */}
      {highlight && (
        <g>
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r="15"
            fill={highlight.color ?? "#facc15"}
            opacity="0.45"
          />
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r="6"
            fill={highlight.color ?? "#eab308"}
          />
          {highlight.label && (
            <text
              x={highlight.x}
              y={highlight.y - 22}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="#854d0e"
            >
              {highlight.label}
            </text>
          )}
        </g>
      )}

      {/* 공기 흐름 애니메이션 */}
      <AirflowOverlay type={airflow} />

      {/* 해부 라벨 */}
      {showLabels && (
        <g fontSize="12" fontWeight="500" fill="#5a3a26">
          <text x="350" y="288" textAnchor="middle">경구개</text>
          <text x="298" y="275" textAnchor="middle">연구개</text>
          <text x="248" y="365" textAnchor="end">인두</text>
          <text x="195" y="520" textAnchor="end">후두</text>
          <text x="195" y="490" textAnchor="end">후두덞개</text>
          <text x="195" y="480" textAnchor="end" fontSize="10">(설골)</text>
          <text x="200" y="620" textAnchor="end">기관</text>
          <text x="492" y="345" textAnchor="start">입술</text>
          <text x="478" y="312" textAnchor="start" fontSize="10">윗니</text>
          {!lipClosure && (
            <text x="478" y="385" textAnchor="start" fontSize="10">아랫니</text>
          )}
          <text x="345" y="230" textAnchor="middle" fontSize="10">비강 / 코덞개</text>
          <text x="55" y="265" textAnchor="middle" fontSize="10">경추</text>
          <text x={tip.x + 8} y={tip.y + 4} fontSize="10" fill="#7a3030" fontWeight="700">
            혁끓
          </text>
          <text x={body.x - 20} y={body.y - 18} fontSize="10" fill="#7a3030" fontWeight="700">
            혁목
          </text>
        </g>
      )}
    </svg>
  );
}
