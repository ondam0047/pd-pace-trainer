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

// viewBox 0 0 580 720
const DEFAULT_TIP = { x: 478, y: 358 };
const DEFAULT_BODY = { x: 395, y: 340 };

// 혁 — 세 제어점으로 큰 공간을 채우는 킷니콩 형태.
// tip(정점/apex) · body(혁목/dorsum) 이 F1·F2 에 따라 이동 → 단면도가 변형.
function tonguePath(
  tip: { x: number; y: number },
  body: { x: number; y: number },
): string {
  const tx = tip.x;
  const ty = tip.y;
  const bx = body.x;
  const by = body.y;
  return `M ${tx} ${ty} C ${tx - 8} ${ty - 18}, ${tx - 30} ${ty - 32}, ${bx + 45} ${by - 8} C ${bx + 18} ${by - 32}, ${bx - 12} ${by - 28}, ${bx - 28} ${by - 5} C ${bx - 58} ${by + 20}, ${bx - 75} ${by + 50}, ${bx - 82} ${by + 80} L 290 462 C 332 478, 390 478, 442 472 C 468 467, ${tx - 5} ${ty + 30}, ${tx} ${ty} Z`;
}

function velumPath(open: boolean): string {
  return open
    ? "M 318 295 C 322 330, 318 365, 308 395 C 298 398, 296 388, 300 380 C 308 350, 312 320, 312 295 Z"
    : "M 318 295 C 300 290, 282 300, 270 310 C 268 322, 278 325, 286 322 C 305 318, 322 308, 322 298 Z";
}

function lipShape(closure: boolean, rounding: number) {
  const r = Math.max(0, Math.min(1, rounding));
  return {
    upper: {
      cx: 466,
      cy: closure ? 358 : 348,
      rx: 14 - r * 3,
      ry: closure ? 8 : 6 + r * 2,
    },
    lower: {
      cx: 468,
      cy: closure ? 365 : 380,
      rx: 15 - r * 3,
      ry: closure ? 9 : 7 + r * 2,
    },
  };
}

// ===== 공기 흐름 애니메이션 오버레이 =====
function AirflowOverlay({ type }: { type: AirflowType }) {
  if (type === "none" || type === "blocked") return null;

  if (type === "plosive_burst") {
    return (
      <g>
        {[0, 0.25, 0.5].map((b) => (
          <circle
            key={b}
            cx="498"
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
              to="42"
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
        <text x="495" y="408" fontSize="11" fill="#0369a1" fontWeight="600">
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
              values="405;500"
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
        <text x="500" y="408" fontSize="11" fill="#0369a1" fontWeight="600">
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
              values="320;345;385;425;460"
              dur="1.5s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="345;275;225;235;293"
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
        <text x="485" y="320" fontSize="11" fill="#0369a1" fontWeight="600">
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
                values="410;485"
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
                values="410;485"
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
        <text x="500" y="325" fontSize="11" fill="#0369a1" fontWeight="600">
          혁 양옥으로
        </text>
        <text x="500" y="408" fontSize="11" fill="#0369a1" fontWeight="600">
          공기 새어나감
        </text>
      </g>
    );
  }

  if (type === "flap") {
    return (
      <g>
        <circle cx="450" cy="330" r="0" fill="#fca5a5">
          <animate
            attributeName="r"
            values="3;9;3;9;3"
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
        <text x="465" y="315" fontSize="11" fill="#b91c1c" fontWeight="600">
          않게 쳤다 떨어짐 (탄설음)
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
        <linearGradient id="vt-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fce5ce" />
          <stop offset="100%" stopColor="#eebd97" />
        </linearGradient>
        <linearGradient id="vt-tongue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eda5a5" />
          <stop offset="55%" stopColor="#d57878" />
          <stop offset="100%" stopColor="#a05050" />
        </linearGradient>
        <radialGradient id="vt-oral" cx="0.55" cy="0.55">
          <stop offset="0%" stopColor="#5c2828" />
          <stop offset="100%" stopColor="#2e1010" />
        </radialGradient>
        <linearGradient id="vt-bone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f5e6c5" />
          <stop offset="100%" stopColor="#ddc090" />
        </linearGradient>
        <linearGradient id="vt-mandible" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d8b0" />
          <stop offset="100%" stopColor="#d4a878" />
        </linearGradient>
        <linearGradient id="vt-palate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3c2a0" />
          <stop offset="100%" stopColor="#d89968" />
        </linearGradient>
        <radialGradient id="vt-turbinate" cx="0.4" cy="0.4">
          <stop offset="0%" stopColor="#e69090" />
          <stop offset="100%" stopColor="#a85050" />
        </radialGradient>
      </defs>

      {/* 경추 — 뛷렷한 내렦 둘레 접제된 돌먣 쓰 올 썰래 구조 */}
      <g>
        {[235, 312, 388, 460].map((y, i) => (
          <g key={i}>
            <path
              d={`M 55 ${y} L 145 ${y + 5} L 152 ${y + 62} L 60 ${y + 58} Z`}
              fill="url(#vt-bone)"
              stroke="#b8884e"
              strokeWidth="1.5"
            />
            <path
              d={`M 60 ${y + 3} L 145 ${y + 8}`}
              stroke="#a07840"
              strokeWidth="0.8"
              opacity="0.6"
              fill="none"
            />
          </g>
        ))}
      </g>

      {/* 외곽 피부 — 부드러운 cubic bezier */}
      <path
        d="M 100 245 C 65 145, 90 75, 165 60 C 245 30, 325 50, 372 88 C 405 120, 412 165, 405 200 L 412 222 C 432 235, 458 255, 478 295 L 478 315 C 470 322, 458 325, 446 322 L 434 340 C 432 352, 430 360, 432 370 C 434 380, 436 388, 432 398 L 422 414 C 410 432, 388 450, 360 458 C 320 470, 270 475, 222 466 C 195 470, 178 490, 178 520 L 182 565 C 195 630, 210 720, 215 720 L 100 720 Z"
        fill="url(#vt-skin)"
        stroke="#a06832"
        strokeWidth="1.5"
      />

      {/* 머리카락 */}
      <path
        d="M 100 245 C 65 145, 90 75, 165 60 C 245 30, 325 50, 372 88 L 365 130 C 320 105, 250 110, 195 130 C 145 150, 110 195, 105 245 Z"
        fill="#5a3a26"
        opacity="0.9"
      />

      {/* 감은 눌 (표정) */}
      <path
        d="M 330 180 C 345 175, 365 178, 380 185"
        stroke="#5a3a26"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 332 185 C 340 188, 365 192, 378 188"
        stroke="#5a3a26"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />

      {/* 코 외곽 곱수 */}
      <path
        d="M 410 198 C 432 215, 458 245, 472 285"
        stroke="#a06832"
        strokeWidth="1.5"
        fill="none"
      />

      {/* 콧구멃 */}
      <ellipse cx="455" cy="303" rx="7" ry="4" fill="#5a2828" />

      {/* 비강 + 구강 어두운 내부 (더 크게) */}
      <path
        d="M 260 195 L 432 240 L 446 295 L 434 312 L 420 314 L 420 340 C 380 365, 320 395, 285 432 L 268 462 L 250 458 Z"
        fill="url(#vt-oral)"
        opacity="0.92"
      />

      {/* 인두 뒤벽 — 점선 */}
      <line
        x1="260"
        y1="195"
        x2="248"
        y2="462"
        stroke="#a06832"
        strokeWidth="2"
        strokeDasharray="5 4"
        opacity="0.65"
      />

      {/* 비강 코덞개 (turbinates) — 3개 둘레 말린 두루마리 형태 */}
      <g stroke="#a04848" strokeWidth="1.2">
        {/* 상비갑개 (적음) */}
        <path
          d="M 270 180 C 295 173, 340 175, 380 180 C 410 185, 425 195, 422 205 C 415 212, 380 213, 340 210 C 300 207, 275 200, 268 192 C 264 188, 266 183, 270 180 Z"
          fill="url(#vt-turbinate)"
          opacity="0.92"
        />
        <path
          d="M 280 188 C 320 184, 370 186, 410 192"
          stroke="#7c3030"
          strokeWidth="0.6"
          fill="none"
          opacity="0.5"
        />

        {/* 중비갑개 (중간) */}
        <path
          d="M 268 218 C 292 210, 340 212, 385 218 C 415 223, 432 232, 428 243 C 420 250, 380 252, 335 249 C 295 246, 270 238, 263 230 C 259 225, 263 220, 268 218 Z"
          fill="url(#vt-turbinate)"
          opacity="0.95"
        />
        <path
          d="M 280 228 C 320 224, 380 226, 420 232"
          stroke="#7c3030"
          strokeWidth="0.6"
          fill="none"
          opacity="0.5"
        />

        {/* 하비갑개 (가장 큼) */}
        <path
          d="M 264 258 C 290 248, 340 250, 388 258 C 422 264, 440 275, 435 285 C 425 290, 388 292, 340 289 C 295 286, 268 280, 258 270 C 254 264, 258 258, 264 258 Z"
          fill="url(#vt-turbinate)"
          opacity="0.95"
        />
        <path
          d="M 280 270 C 320 266, 390 268, 425 274"
          stroke="#7c3030"
          strokeWidth="0.6"
          fill="none"
          opacity="0.5"
        />
      </g>

      {/* 경구개 (hard palate) — 많이 세련된 아치 */}
      <path
        d="M 445 305 C 405 295, 360 295, 318 302 L 314 314 C 360 305, 410 310, 442 320 Z"
        fill="url(#vt-palate)"
        stroke="#a06832"
        strokeWidth="1.2"
      />

      {/* 연구개 (동적) */}
      <path
        d={velumD}
        fill="#d27878"
        stroke="#a05050"
        strokeWidth="1.5"
      />

      {/* 목젠 */}
      {velumOpen ? (
        <ellipse cx="304" cy="402" rx="4" ry="7" fill="#c47070" />
      ) : (
        <ellipse cx="275" cy="320" rx="4" ry="6" fill="#c47070" />
      )}

      {/* 윗니 — 더 대세워진 4개 */}
      <g>
        {[442, 433, 422, 410].map((x, i) => (
          <g key={`ut-${i}`}>
            <rect
              x={x}
              y="316"
              width="8"
              height="15"
              fill="#fff"
              stroke="#a0a0a0"
              strokeWidth="0.8"
              rx="2"
            />
            <line
              x1={x + 1}
              y1="318"
              x2={x + 7}
              y2="318"
              stroke="#d0c8c0"
              strokeWidth="0.6"
            />
          </g>
        ))}
      </g>

      {/* 하악(mandible) 골격 — 쪽이 있는 뻗 모양 */}
      <path
        d="M 248 458 C 290 478, 360 482, 410 470 C 432 463, 442 446, 442 425 L 438 400 C 436 388, 432 380, 432 372"
        fill="url(#vt-mandible)"
        stroke="#b8884e"
        strokeWidth="2.5"
        opacity="0.85"
      />
      <path
        d="M 252 462 C 290 470, 360 475, 408 466"
        stroke="#a07840"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />

      {/* 아랫니 (입 열릴 때) */}
      {!lipClosure && (
        <g>
          {[442, 433, 422, 410].map((x, i) => (
            <g key={`lt-${i}`}>
              <rect
                x={x}
                y="382"
                width="8"
                height="15"
                fill="#fff"
                stroke="#a0a0a0"
                strokeWidth="0.8"
                rx="2"
              />
              <line
                x1={x + 1}
                y1="384"
                x2={x + 7}
                y2="384"
                stroke="#d0c8c0"
                strokeWidth="0.6"
              />
            </g>
          ))}
        </g>
      )}

      {/* 혁 — 큰 킷니콩 형태, 구강 채움 */}
      <g>
        {airflow === "flap" && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -10; 0 0"
            dur="0.35s"
            repeatCount="indefinite"
          />
        )}
        <path
          d={tongueD}
          fill="url(#vt-tongue)"
          stroke="#8a4040"
          strokeWidth="1.8"
          style={{ transition: "d 0.25s ease-out" }}
        />
        {/* 혁 중앙 음영 */}
        <path
          d={`M ${body.x - 30} ${body.y + 5} C ${body.x - 20} ${body.y + 15}, ${body.x + 20} ${body.y + 15}, ${body.x + 35} ${body.y + 8}`}
          stroke="#7e3030"
          strokeWidth="0.7"
          fill="none"
          opacity="0.5"
        />
        <circle
          cx={tip.x}
          cy={tip.y}
          r="5"
          fill="#7e3030"
          style={{ transition: "cx 0.25s, cy 0.25s" }}
        />
      </g>

      {/* 입술 — 더 자연스러운 모양 */}
      <path
        d={`M ${lips.upper.cx - lips.upper.rx} ${lips.upper.cy} C ${lips.upper.cx - lips.upper.rx} ${lips.upper.cy - lips.upper.ry}, ${lips.upper.cx + lips.upper.rx} ${lips.upper.cy - lips.upper.ry}, ${lips.upper.cx + lips.upper.rx} ${lips.upper.cy} C ${lips.upper.cx + lips.upper.rx} ${lips.upper.cy + lips.upper.ry}, ${lips.upper.cx - lips.upper.rx} ${lips.upper.cy + lips.upper.ry}, ${lips.upper.cx - lips.upper.rx} ${lips.upper.cy} Z`}
        fill="#d97757"
        style={{ transition: "d 0.3s" }}
      />
      <path
        d={`M ${lips.lower.cx - lips.lower.rx} ${lips.lower.cy} C ${lips.lower.cx - lips.lower.rx} ${lips.lower.cy - lips.lower.ry}, ${lips.lower.cx + lips.lower.rx} ${lips.lower.cy - lips.lower.ry}, ${lips.lower.cx + lips.lower.rx} ${lips.lower.cy} C ${lips.lower.cx + lips.lower.rx} ${lips.lower.cy + lips.lower.ry}, ${lips.lower.cx - lips.lower.rx} ${lips.lower.cy + lips.lower.ry}, ${lips.lower.cx - lips.lower.rx} ${lips.lower.cy} Z`}
        fill="#c95f3f"
        style={{ transition: "d 0.3s" }}
      />

      {/* 설골 (hyoid) */}
      <ellipse
        cx="262"
        cy="495"
        rx="28"
        ry="7"
        fill="url(#vt-bone)"
        stroke="#b8884e"
        strokeWidth="1.5"
      />
      <ellipse
        cx="262"
        cy="493"
        rx="24"
        ry="3"
        fill="none"
        stroke="#a07840"
        strokeWidth="0.6"
        opacity="0.5"
      />

      {/* 후두덞개 (epiglottis) — 잎 모양 */}
      <path
        d="M 254 514 C 244 498, 250 480, 262 478 C 278 482, 274 510, 270 516 C 264 520, 256 518, 254 514 Z"
        fill="#e0a0a0"
        stroke="#a05050"
        strokeWidth="1.2"
      />

      {/* 후두 (larynx) — 필와움의 타원 */}
      <ellipse
        cx="225"
        cy="545"
        rx="38"
        ry="27"
        fill="#f0d8c8"
        stroke="#a05050"
        strokeWidth="1.8"
      />
      <ellipse
        cx="225"
        cy="541"
        rx="34"
        ry="6"
        fill="none"
        stroke="#a05050"
        strokeWidth="0.8"
        opacity="0.4"
      />

      {/* 성대 (2개 흰 슬릿) */}
      <line
        x1="200"
        y1="545"
        x2="250"
        y2="545"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="215"
        y1="545"
        x2="235"
        y2="545"
        stroke="#a05050"
        strokeWidth="1.5"
      />

      {/* 기관 (trachea) 연공률 7개 */}
      <path
        d="M 200 572 L 198 720 M 252 572 L 254 720"
        stroke="#a06832"
        strokeWidth="2"
        fill="none"
      />
      {[594, 614, 634, 654, 674, 694].map((y) => (
        <line
          key={`tr-${y}`}
          x1="200"
          y1={y}
          x2="252"
          y2={y}
          stroke="#d08868"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}

      {/* 하이라이트 */}
      {highlight && (
        <g>
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r="16"
            fill={highlight.color ?? "#facc15"}
            opacity="0.45"
          />
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r="7"
            fill={highlight.color ?? "#eab308"}
          />
          {highlight.label && (
            <text
              x={highlight.x}
              y={highlight.y - 24}
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
          <text x="345" y="196" textAnchor="middle" fontSize="11">
            비강 / 코덞개
          </text>
          <text x="302" y="285" textAnchor="middle" fontSize="11">
            연구개
          </text>
          <text x="380" y="328" textAnchor="middle" fontSize="11">
            경구개
          </text>
          <text x="246" y="360" textAnchor="end" fontSize="11">
            인두
          </text>
          <text x="190" y="500" textAnchor="end" fontSize="11">
            (설골)
          </text>
          <text x="190" y="515" textAnchor="end" fontSize="11">
            후두덞개
          </text>
          <text x="185" y="548" textAnchor="end" fontSize="11">
            후두
          </text>
          <text x="190" y="625" textAnchor="end" fontSize="11">
            기관
          </text>
          <text x="500" y="360" textAnchor="start" fontSize="11">
            입술
          </text>
          <text x="478" y="311" textAnchor="start" fontSize="10">
            윗니
          </text>
          {!lipClosure && (
            <text x="478" y="400" textAnchor="start" fontSize="10">
              아랫니
            </text>
          )}
          <text x="32" y="272" textAnchor="middle" fontSize="10">
            경추
          </text>
          <text x={tip.x - 5} y={tip.y - 10} fontSize="10" fill="#7e3030" fontWeight="700">
            혁끓
          </text>
        </g>
      )}
    </svg>
  );
}
