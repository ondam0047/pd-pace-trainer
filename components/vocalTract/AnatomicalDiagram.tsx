"use client";

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

// PNG 임의 좀 대략 추정 — 실제 파일 크기가 달라도 SVG 가 자동 스케일링함
const BG_WIDTH = 887;
const BG_HEIGHT = 1024;

const DEFAULT_TIP = { x: 660, y: 640 };
const DEFAULT_BODY = { x: 540, y: 680 };

// ===== 공기 흐름 애니메이션 =====
function AirflowOverlay({ type }: { type: AirflowType }) {
  if (type === "none" || type === "blocked") return null;

  if (type === "plosive_burst") {
    return (
      <g>
        {[0, 0.25, 0.5].map((b) => (
          <circle
            key={b}
            cx="805"
            cy="660"
            r="0"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="5"
            opacity="0"
          >
            <animate
              attributeName="r"
              from="5"
              to="65"
              dur="0.75s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.85;0"
              dur="0.75s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <text x="805" y="760" fontSize="22" fill="#0369a1" fontWeight="800" textAnchor="middle">
          폭발장
        </text>
      </g>
    );
  }

  if (type === "fricative_oral") {
    return (
      <g>
        {[0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72].map((b) => (
          <circle key={b} r="6" fill="#0ea5e9" opacity="0">
            <animate
              attributeName="cx"
              values="610;815"
              dur="0.85s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="645;660"
              dur="0.85s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.9;0.9;0"
              keyTimes="0;0.15;0.85;1"
              dur="0.85s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <text x="810" y="760" fontSize="20" fill="#0369a1" fontWeight="700" textAnchor="middle">
          좋은 마찰 통로
        </text>
      </g>
    );
  }

  if (type === "nasal") {
    return (
      <g>
        {[0, 0.3, 0.6, 0.9].map((b) => (
          <circle key={b} r="7" fill="#38bdf8" opacity="0">
            <animate
              attributeName="cx"
              values="500;510;620;750;805"
              dur="1.5s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="680;500;330;260;285"
              dur="1.5s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.9;0.9;0.9;0"
              keyTimes="0;0.1;0.5;0.9;1"
              dur="1.5s"
              begin={`${b}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <text x="800" y="210" fontSize="22" fill="#0369a1" fontWeight="800">
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
            <circle r="5" fill="#38bdf8" opacity="0">
              <animate
                attributeName="cx"
                values="625;805"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values="645;615"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.9;0.9;0"
                keyTimes="0;0.15;0.85;1"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle r="5" fill="#38bdf8" opacity="0">
              <animate
                attributeName="cx"
                values="625;805"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values="675;710"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.9;0.9;0"
                keyTimes="0;0.15;0.85;1"
                dur="0.8s"
                begin={`${b}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
        <text x="820" y="600" fontSize="18" fill="#0369a1" fontWeight="700" textAnchor="middle">
          혁 양옥으로
        </text>
        <text x="820" y="760" fontSize="18" fill="#0369a1" fontWeight="700" textAnchor="middle">
          공기 새어나감
        </text>
      </g>
    );
  }

  if (type === "flap") {
    return (
      <g>
        <circle cx="715" cy="545" r="0" fill="#fca5a5">
          <animate
            attributeName="r"
            values="5;16;5;16;5"
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
        <text x="740" y="525" fontSize="18" fill="#b91c1c" fontWeight="700">
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
  const highlight = state?.highlight;
  const airflow = state?.airflow ?? "none";

  return (
    <svg viewBox={`0 0 ${BG_WIDTH} ${BG_HEIGHT}`} className="w-full">
      {/* PNG 해부 일러스트레이션 배경 */}
      <image
        href="/vocal-tract.png"
        x={0}
        y={0}
        width={BG_WIDTH}
        height={BG_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* 혁끓 위치 마커 (F1/F2 기반) */}
      <g>
        <circle
          cx={tip.x}
          cy={tip.y}
          r="18"
          fill="#dc2626"
          opacity="0.78"
          stroke="white"
          strokeWidth="4"
          style={{ transition: "cx 0.25s ease-out, cy 0.25s ease-out" }}
        />
        <text
          x={tip.x}
          y={tip.y - 30}
          textAnchor="middle"
          fontSize="18"
          fontWeight="800"
          fill="#7f1d1d"
          stroke="white"
          strokeWidth="3"
          paintOrder="stroke"
        >
          혁끓
        </text>
      </g>

      {/* 혁목 위치 마커 */}
      <g>
        <circle
          cx={body.x}
          cy={body.y}
          r="16"
          fill="#f59e0b"
          opacity="0.72"
          stroke="white"
          strokeWidth="3"
          style={{ transition: "cx 0.25s ease-out, cy 0.25s ease-out" }}
        />
        <text
          x={body.x}
          y={body.y + 34}
          textAnchor="middle"
          fontSize="16"
          fontWeight="800"
          fill="#92400e"
          stroke="white"
          strokeWidth="3"
          paintOrder="stroke"
        >
          혁목
        </text>
      </g>

      {/* 연구개 상태 표시 */}
      {velumOpen ? (
        <g>
          <ellipse cx="585" cy="560" rx="30" ry="15" fill="#facc15" opacity="0.55" />
          <text
            x="585"
            y="528"
            textAnchor="middle"
            fontSize="16"
            fontWeight="800"
            fill="#92400e"
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            연구개 하강
          </text>
        </g>
      ) : (
        <g>
          <ellipse cx="585" cy="515" rx="28" ry="12" fill="#86efac" opacity="0.5" />
          <text
            x="585"
            y="495"
            textAnchor="middle"
            fontSize="16"
            fontWeight="800"
            fill="#14532d"
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            연구개 닫힘
          </text>
        </g>
      )}

      {/* 입술 폐쇄 표시 */}
      {lipClosure && (
        <g>
          <rect
            x="760"
            y="645"
            width="60"
            height="12"
            rx="5"
            fill="#dc2626"
            opacity="0.9"
          />
          <text
            x="790"
            y="630"
            textAnchor="middle"
            fontSize="16"
            fontWeight="800"
            fill="#7f1d1d"
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            입술 폐쇄
          </text>
        </g>
      )}

      {/* 하이라이트 (조음 접촉점) */}
      {highlight && (
        <g>
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r="24"
            fill={highlight.color ?? "#facc15"}
            opacity="0.55"
          />
          <circle
            cx={highlight.x}
            cy={highlight.y}
            r="10"
            fill={highlight.color ?? "#eab308"}
            stroke="white"
            strokeWidth="2.5"
          />
          {highlight.label && (
            <text
              x={highlight.x}
              y={highlight.y - 36}
              textAnchor="middle"
              fontSize="16"
              fontWeight="800"
              fill="#854d0e"
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {highlight.label}
            </text>
          )}
        </g>
      )}

      {/* 공기 흐름 애니메이션 */}
      <AirflowOverlay type={airflow} />
    </svg>
  );
}
