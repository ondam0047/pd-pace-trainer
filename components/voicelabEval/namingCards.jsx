/**
 * voicelab 평가 모듈 — 이름대기 그림카드 (자체 SVG 일러스트)
 *
 * 15개 카드 = HANDOFF.md TODO 7 처리. Wikimedia/Pixabay 가 아니라 우리가 직접 그린
 * SVG 라 라이선스 100% 자체. 외부 자산 없음 — 의존성 0, 다크모드/고대비도 currentColor
 * 로 적응.
 *
 * 어르신 인지 정확도를 위해 너무 추상화하지 않고 윤곽선·기본 색까지 넣었다. 한국 토속물
 * (절구·호미·부채)도 한국형 모양으로 그렸다 (서양 mortar 가 아닌 한국 절구 등).
 *
 * 사용:
 *   import { NamingCard, NAMING_ITEMS } from "./namingCards";
 *   <NamingCard item="사과" size={120} />
 */

const Apple = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    <path d="M100 55 C75 45 50 60 50 100 C50 145 75 175 100 175 C125 175 150 145 150 100 C150 60 125 45 100 55 Z" fill="#fca5a5" stroke="currentColor" strokeWidth="4" />
    <path d="M88 56 Q100 46 112 56" fill="#fee2e2" stroke="currentColor" strokeWidth="3" />
    <line x1="100" y1="50" x2="100" y2="32" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M100 38 Q120 28 130 45 Q113 50 100 42 Z" fill="#86efac" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
  </svg>
);

const Clock = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    <circle cx="100" cy="100" r="75" fill="#fef3c7" stroke="currentColor" strokeWidth="4" />
    <line x1="100" y1="35" x2="100" y2="50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="165" y1="100" x2="150" y2="100" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="165" x2="100" y2="150" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="35" y1="100" x2="50" y2="100" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="100" x2="78" y2="62" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <line x1="100" y1="100" x2="135" y2="100" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <circle cx="100" cy="100" r="5" fill="currentColor" />
  </svg>
);

const Umbrella = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    <path d="M28 112 Q100 22 172 112 Q136 100 100 112 Q64 100 28 112 Z" fill="#7dd3fc" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    <path d="M64 108 Q100 60 100 108" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <path d="M100 108 Q100 60 136 108" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <line x1="100" y1="108" x2="100" y2="166" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M100 166 Q100 182 84 182 Q74 182 74 174" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <line x1="100" y1="38" x2="100" y2="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const Glasses = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    <circle cx="60" cy="105" r="34" fill="#dbeafe" stroke="currentColor" strokeWidth="4" />
    <circle cx="140" cy="105" r="34" fill="#dbeafe" stroke="currentColor" strokeWidth="4" />
    <path d="M93 100 Q100 90 107 100" fill="none" stroke="currentColor" strokeWidth="4" />
    <path d="M27 100 L10 88" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M173 100 L190 88" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const Bag = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    <path d="M70 80 Q70 38 100 38 Q130 38 130 80" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    <rect x="38" y="80" width="124" height="92" rx="10" fill="#fde68a" stroke="currentColor" strokeWidth="4" />
    <rect x="90" y="118" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
  </svg>
);

const Kettle = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    <ellipse cx="100" cy="135" rx="58" ry="42" fill="#cbd5e1" stroke="currentColor" strokeWidth="4" />
    <path d="M152 118 L188 90 L183 110 L160 132 Z" fill="#cbd5e1" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    <path d="M68 92 Q100 50 132 92" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    <rect x="80" y="88" width="40" height="10" rx="3" fill="#cbd5e1" stroke="currentColor" strokeWidth="3" />
    <circle cx="100" cy="82" r="6" fill="currentColor" />
  </svg>
);

const Broom = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 자루 */}
    <line x1="30" y1="180" x2="135" y2="55" stroke="#92400e" strokeWidth="8" strokeLinecap="round" />
    {/* 묶음 끈 */}
    <line x1="118" y1="72" x2="152" y2="50" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="124" y1="82" x2="158" y2="60" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    {/* 짚 솔 (방사형) */}
    <line x1="138" y1="52" x2="190" y2="30" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="138" y1="52" x2="195" y2="55" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="138" y1="52" x2="190" y2="80" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="138" y1="52" x2="180" y2="12" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="138" y1="52" x2="165" y2="8" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="138" y1="52" x2="148" y2="8" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="138" y1="52" x2="172" y2="100" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const Magnifier = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    <line x1="118" y1="118" x2="172" y2="172" stroke="#78350f" strokeWidth="14" strokeLinecap="round" />
    <line x1="118" y1="118" x2="172" y2="172" stroke="#92400e" strokeWidth="9" strokeLinecap="round" />
    <circle cx="80" cy="80" r="52" fill="#dbeafe" stroke="currentColor" strokeWidth="6" />
    <path d="M55 60 Q60 50 72 50" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const Iron = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 다리미 바닥 (앞이 뾰족) */}
    <path d="M18 130 L155 130 L185 152 L160 162 L18 162 Z" fill="#9ca3af" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    {/* 손잡이 (위쪽 아치) */}
    <path d="M52 130 Q52 78 92 78 L118 78 Q150 78 150 130" fill="#374151" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    <path d="M68 130 Q68 92 92 92 L118 92 Q138 92 138 130" fill="#9ca3af" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    {/* 전기 코드 */}
    <path d="M172 140 Q188 122 192 100" fill="none" stroke="currentColor" strokeWidth="3" />
  </svg>
);

const Bicycle = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 바퀴 */}
    <circle cx="55" cy="140" r="32" fill="none" stroke="currentColor" strokeWidth="5" />
    <circle cx="145" cy="140" r="32" fill="none" stroke="currentColor" strokeWidth="5" />
    {/* 살 */}
    <line x1="55" y1="108" x2="55" y2="172" stroke="currentColor" strokeWidth="1.5" />
    <line x1="23" y1="140" x2="87" y2="140" stroke="currentColor" strokeWidth="1.5" />
    <line x1="145" y1="108" x2="145" y2="172" stroke="currentColor" strokeWidth="1.5" />
    <line x1="113" y1="140" x2="177" y2="140" stroke="currentColor" strokeWidth="1.5" />
    {/* 프레임 — 다이아 형 */}
    <line x1="55" y1="140" x2="100" y2="140" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="140" x2="100" y2="78" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="78" x2="148" y2="92" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="140" x2="148" y2="92" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="145" y1="140" x2="148" y2="92" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    {/* 핸들 */}
    <line x1="148" y1="92" x2="160" y2="78" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <line x1="153" y1="78" x2="170" y2="80" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    {/* 안장 */}
    <rect x="86" y="72" width="28" height="8" rx="3" fill="currentColor" />
    {/* 페달 */}
    <circle cx="100" cy="140" r="5" fill="currentColor" />
  </svg>
);

const Elephant = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 몸통 */}
    <ellipse cx="110" cy="115" rx="60" ry="38" fill="#d1d5db" stroke="currentColor" strokeWidth="4" />
    {/* 머리 */}
    <circle cx="58" cy="100" r="32" fill="#d1d5db" stroke="currentColor" strokeWidth="4" />
    {/* 귀 */}
    <ellipse cx="55" cy="78" rx="22" ry="20" fill="#9ca3af" stroke="currentColor" strokeWidth="3" transform="rotate(-25 55 78)" />
    {/* 코 */}
    <path d="M30 102 Q14 130 22 158 Q28 168 42 162 Q34 152 38 142" fill="#d1d5db" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    {/* 눈 */}
    <circle cx="55" cy="95" r="3.5" fill="currentColor" />
    {/* 꼬리 */}
    <path d="M170 115 Q186 115 180 135" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    {/* 다리 */}
    <line x1="75" y1="150" x2="75" y2="180" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    <line x1="105" y1="152" x2="105" y2="180" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    <line x1="135" y1="152" x2="135" y2="180" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    <line x1="160" y1="150" x2="160" y2="180" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
  </svg>
);

const Mortar = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 절굿공이 (뒤에서 비스듬히) */}
    <line x1="172" y1="22" x2="118" y2="100" stroke="#92400e" strokeWidth="14" strokeLinecap="round" />
    <line x1="172" y1="22" x2="118" y2="100" stroke="#78350f" strokeWidth="9" strokeLinecap="round" />
    {/* 절구 몸통 — 아래로 좁아지는 사다리꼴 */}
    <path d="M45 90 L155 90 L142 178 L58 178 Z" fill="#a8a29e" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    {/* 외곽 그림자 */}
    <path d="M58 178 L142 178 L138 174 L62 174 Z" fill="#78716c" stroke="none" />
    {/* 상단 림 */}
    <ellipse cx="100" cy="90" rx="55" ry="11" fill="#78716c" stroke="currentColor" strokeWidth="4" />
    {/* 내부 공동 */}
    <ellipse cx="100" cy="92" rx="44" ry="7" fill="#1c1917" stroke="none" />
  </svg>
);

const Hoe = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 나무 자루 */}
    <line x1="25" y1="40" x2="100" y2="125" stroke="#92400e" strokeWidth="14" strokeLinecap="round" />
    <line x1="25" y1="40" x2="100" y2="125" stroke="#78350f" strokeWidth="9" strokeLinecap="round" />
    {/* 자루-날 연결부 (꺾이는 목) */}
    <path d="M95 120 Q108 132 110 148" fill="none" stroke="#374151" strokeWidth="7" strokeLinecap="round" />
    {/* 한국형 호미 날 — 삼각/물방울 모양, 끝이 뾰족 */}
    <path d="M105 142 Q140 152 175 178 Q160 184 130 176 Q108 168 100 155 Z" fill="#6b7280" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
    {/* 날 능선 */}
    <path d="M110 152 Q140 160 165 175" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Fan = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 부채 면 */}
    <path d="M100 168 L30 78 Q100 18 170 78 Z" fill="#fef3c7" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    {/* 살(rib) */}
    <line x1="100" y1="168" x2="44" y2="92" stroke="currentColor" strokeWidth="2" />
    <line x1="100" y1="168" x2="72" y2="55" stroke="currentColor" strokeWidth="2" />
    <line x1="100" y1="168" x2="100" y2="40" stroke="currentColor" strokeWidth="2" />
    <line x1="100" y1="168" x2="128" y2="55" stroke="currentColor" strokeWidth="2" />
    <line x1="100" y1="168" x2="156" y2="92" stroke="currentColor" strokeWidth="2" />
    {/* 호 (상단 곡선 강조) */}
    <path d="M30 78 Q100 18 170 78" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    {/* 손잡이 (사목) */}
    <line x1="100" y1="168" x2="100" y2="185" stroke="#92400e" strokeWidth="6" strokeLinecap="round" />
    {/* 핀 */}
    <circle cx="100" cy="168" r="6" fill="currentColor" />
  </svg>
);

const Scissors = (p) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* 날 1 (좌상에서 중앙으로) */}
    <path d="M55 18 L66 26 L112 92 L100 102 Z" fill="#e5e7eb" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
    {/* 날 2 (우상에서 중앙으로) */}
    <path d="M145 18 L134 26 L88 92 L100 102 Z" fill="#e5e7eb" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
    {/* 손잡이 */}
    <path d="M100 102 Q80 130 58 142" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    <path d="M100 102 Q120 130 142 142" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    {/* 손잡이 구멍 */}
    <ellipse cx="50" cy="158" rx="22" ry="26" fill="none" stroke="currentColor" strokeWidth="5" />
    <ellipse cx="150" cy="158" rx="22" ry="26" fill="none" stroke="currentColor" strokeWidth="5" />
    {/* 핀 */}
    <circle cx="100" cy="102" r="5" fill="currentColor" />
  </svg>
);

/** 이름대기 15문항 — 본 순서를 모듈과 일치시킨다 (HANDOFF §3 표). */
export const NAMING_ITEMS = [
  "사과", "시계", "우산", "안경", "가방",
  "주전자", "빗자루", "돋보기", "다리미", "자전거",
  "코끼리", "절구", "호미", "부채", "가위",
];

const ART_MAP = {
  "사과": Apple,
  "시계": Clock,
  "우산": Umbrella,
  "안경": Glasses,
  "가방": Bag,
  "주전자": Kettle,
  "빗자루": Broom,
  "돋보기": Magnifier,
  "다리미": Iron,
  "자전거": Bicycle,
  "코끼리": Elephant,
  "절구": Mortar,
  "호미": Hoe,
  "부채": Fan,
  "가위": Scissors,
};

/**
 * 카드 1개를 정사각 박스에 그린다.
 * `size` 픽셀 단위 (기본 96). 어르신에게 보여줄 때는 size=420 정도.
 * 한글 라벨은 절대 같이 그리지 않는다 — 검사 무효화 방지.
 */
export function NamingCard({ item, size = 96, className = "" }) {
  const Cmp = ART_MAP[item];
  if (!Cmp) {
    return (
      <div
        className={`inline-flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg ${className}`}
        style={{ width: size, height: size }}
        aria-label={`이미지 없음: ${item}`}
      >
        ?
      </div>
    );
  }
  return (
    <Cmp
      width={size}
      height={size}
      className={`text-slate-800 ${className}`}
      role="img"
      aria-label={item}
    />
  );
}
