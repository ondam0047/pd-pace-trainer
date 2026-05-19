import type { ArticulationState } from "./AnatomicalDiagram";

export type ClinicalNote = {
  commonErrors: string[];
  facilitation: string[];
  acousticTip?: string;
};

export type KoreanConsonant = {
  hangul: string;
  ipa: string;
  romanization: string;
  place: "양순" | "치조" | "경구개" | "연구개" | "성문";
  manner: string;
  priority: "high" | "medium" | "low"; // 임상 중요도
  description: string;
  articulation: ArticulationState;
  clinical: ClinicalNote;
};

// 좌표: AnatomicalDiagram viewBox 480×480
// 기본 혁 위치: tip(370, 285), body(320, 280) — 휴지
const REST_TIP = { x: 370, y: 285 };
const REST_BODY = { x: 320, y: 280 };

export const KOREAN_CONSONANTS: KoreanConsonant[] = [
  // ——————————————————————————————————————————————————————————————————
  // 양순음 — 참조/대조용 (쉬움)
  // ——————————————————————————————————————————————————————————————————
  {
    hangul: "ㅁ",
    ipa: "m",
    romanization: "m",
    place: "양순",
    manner: "비음",
    priority: "low",
    description: "입술을 닫고 코로 공기. 연구개가 내려와서 비강이 열림.",
    articulation: {
      tongueTip: REST_TIP,
      tongueBody: REST_BODY,
      velumOpen: true,
      lipClosure: true,
      highlight: { x: 420, y: 274, color: "#facc15" },
    },
    clinical: {
      commonErrors: ["ㅏ으로 생략", "ㅂ으로 탈비음화"],
      facilitation: [
        "코에 손가락 대고 진동 느끼면서 긴 “음—” 일으키기",
        "“마·머·모” 교대 반복",
      ],
    },
  },
  {
    hangul: "ㅂ",
    ipa: "p",
    romanization: "b/p",
    place: "양순",
    manner: "파열음(평음)",
    priority: "low",
    description: "입술을 닫았다 갑자기 터트림. 연구개는 닫혀서 코로 공기 안 새짐.",
    articulation: {
      tongueTip: REST_TIP,
      tongueBody: REST_BODY,
      velumOpen: false,
      lipClosure: true,
      highlight: { x: 420, y: 274, color: "#fb923c" },
    },
    clinical: {
      commonErrors: ["ㅁ과 혼동 (비강을 제대로 닫지 못함)"],
      facilitation: [
        "코 막고 발음 해보기 — ㅂ은 가능, ㅁ은 코가 막혀 불가",
      ],
    },
  },

  // ——————————————————————————————————————————————————————————————————
  // 치조음
  // ——————————————————————————————————————————————————————————————————
  {
    hangul: "ㄴ",
    ipa: "n",
    romanization: "n",
    place: "치조",
    manner: "비음",
    priority: "medium",
    description: "혁끓을 윗잊못(치조융기)에 대고 연구개 하강 → 코로 공기.",
    articulation: {
      tongueTip: { x: 375, y: 247 },
      tongueBody: { x: 330, y: 265 },
      velumOpen: true,
      lipClosure: false,
      highlight: { x: 376, y: 248, label: "치조", color: "#facc15" },
    },
    clinical: {
      commonErrors: ["ㄷ으로 탈비음화 (연구개 닫힘)"],
      facilitation: [
        "코 손가락으로 진동 확인 + ㄷ 비교",
        "“나·너·노” 모음 변환 반복",
      ],
    },
  },
  {
    hangul: "ㄷ",
    ipa: "t",
    romanization: "d/t",
    place: "치조",
    manner: "파열음(평음)",
    priority: "medium",
    description: "혁끓을 치조융기에 대고 떼면서 파열. 구강음.",
    articulation: {
      tongueTip: { x: 375, y: 247 },
      tongueBody: { x: 330, y: 265 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 376, y: 248, label: "치조", color: "#fb923c" },
    },
    clinical: {
      commonErrors: ["ㅌ과 혼동 (기이 과다)", "ㄱ으로 후방화"],
      facilitation: [
        "손등에 입검 대고 기의 양 확인 → ㅌ처럼 세지 않아야 ㄷ",
      ],
    },
  },
  {
    hangul: "ㄹ_탄설",
    ipa: "ɾ",
    romanization: "r (flap)",
    place: "치조",
    manner: "유음 (탄설음, 며수으로)",
    priority: "high",
    description: "혁끓이 치조융기를 알게 치는 탄설음. 모음 사이(아리, 우리)에서 나타남.",
    articulation: {
      tongueTip: { x: 375, y: 247 },
      tongueBody: { x: 330, y: 268 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 376, y: 248, label: "않은 접촉", color: "#facc15" },
    },
    clinical: {
      commonErrors: ["ㄷ/ㄴ으로 대치 (접촉이 길어짐)"],
      facilitation: [
        "“따따따” 빠른 연속 발성 → 점차 하나 “따”를 “더”로",
        "영어 butter 의 [ɾ] 참조",
      ],
    },
  },
  {
    hangul: "ㄹ_설측",
    ipa: "l",
    romanization: "l (lateral)",
    place: "치조",
    manner: "유음 (설측음)",
    priority: "high",
    description: "혁끓은 치조에 닿고 혁 양옥으로 공기가 흐름. 종성·주로 연속어 머리에.",
    articulation: {
      tongueTip: { x: 375, y: 247 },
      tongueBody: { x: 330, y: 268 },
      velumOpen: false,
      lipClosure: false,
      lateralAirflow: true,
      highlight: { x: 376, y: 248, label: "지속 접촉", color: "#facc15" },
    },
    clinical: {
      commonErrors: ["ㄷ/ㄴ으로 대치", "탄설음과 혼용"],
      facilitation: [
        "긴 “알—” 지속, 혁이 떨어지지 않도록 유지",
        "거울 앞에서 혁 양옥 공간 확인",
      ],
    },
  },
  {
    hangul: "ㅅ",
    ipa: "s",
    romanization: "s",
    place: "치조",
    manner: "마찰음(평음)",
    priority: "high",
    description: "혁끓을 치조융기 알에 두고 가운데 좋은 통로로 공기를 내보냄. 아동 조음 장애의 핵심.",
    articulation: {
      tongueTip: { x: 370, y: 252 },
      tongueBody: { x: 335, y: 268 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 372, y: 250, label: "좋은 통로", color: "#34d399" },
    },
    clinical: {
      commonErrors: [
        "ㅈ과 혼동 (파찰화)",
        "ɕ · ʃ로 구개화 (혁을 너무 뒤로)",
        "ㅌ으로 탈마찰화",
      ],
      facilitation: [
        "이 달고 아래턱니과 윗니 평행 맞추기",
        "빨대 발음 (straw cueing) — 가늘고 긴 통로 이미지",
        "대조 훈련: ㅅ/ɕ (ㅅㅣ vs ㅅㅣㅣ) 구별",
      ],
      acousticTip: "스펙트럼 중심 ≈ 5500–8500Hz. /ʃ/(왜곡)은 2800–4500Hz.",
    },
  },
  {
    hangul: "ㅆ",
    ipa: "s͈",
    romanization: "ss",
    place: "치조",
    manner: "마찰음(경음)",
    priority: "high",
    description: "ㅅ보다 혁 긴장·알력 더 큼. 이목이은 더 머남.",
    articulation: {
      tongueTip: { x: 370, y: 252 },
      tongueBody: { x: 335, y: 268 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 372, y: 250, label: "알력 교서", color: "#22c55e" },
    },
    clinical: {
      commonErrors: ["ㅅ으로 약화 (이완해짐)"],
      facilitation: [
        "입 앞에 휴지 대고 휴지가 더 강하게 움직이는 것 확인",
      ],
    },
  },

  // ——————————————————————————————————————————————————————————————————
  // 경구개음 (파찰음)
  // ——————————————————————————————————————————————————————————————————
  {
    hangul: "ㅈ",
    ipa: "tɕ",
    romanization: "j",
    place: "경구개",
    manner: "파찰음(평음)",
    priority: "high",
    description: "혁날·혁목이 경구개에 닿아 파열 → 마찰 이어짐. 너무 앞으로 가면 ㄷ·ㅅ과 혼동.",
    articulation: {
      tongueTip: { x: 360, y: 252 },
      tongueBody: { x: 332, y: 235 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 335, y: 233, label: "경구개", color: "#a78bfa" },
    },
    clinical: {
      commonErrors: ["ㄷ으로 탈파찰화", "ㅅ과 혼동 (파열 누락)"],
      facilitation: [
        "ㄷ + ㅅ 소림 고민 → 연속도는 느낌",
        "거울 틀어 보며 혁 위치 확인 (너무 앞·뒤 X)",
      ],
    },
  },
  {
    hangul: "ㅊ",
    ipa: "tɕʰ",
    romanization: "ch",
    place: "경구개",
    manner: "파찰음(격음)",
    priority: "high",
    description: "ㅈ + 강한 기음. 기의 양이 핵심.",
    articulation: {
      tongueTip: { x: 360, y: 252 },
      tongueBody: { x: 332, y: 235 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 335, y: 233, label: "경구개", color: "#c084fc" },
    },
    clinical: {
      commonErrors: ["ㅈ과 혼동 (기음 부족)"],
      facilitation: [
        "입 앞 종이 휠림 대비 (ㅈ 약, ㅊ 강)",
      ],
    },
  },
  {
    hangul: "ㅉ",
    ipa: "tɕ͈",
    romanization: "jj",
    place: "경구개",
    manner: "파찰음(경음)",
    priority: "high",
    description: "ㅈ보다 긴장 경음. 기이 적고 알력만 큼.",
    articulation: {
      tongueTip: { x: 360, y: 252 },
      tongueBody: { x: 332, y: 235 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 335, y: 233, label: "경구개 긴장", color: "#a855f7" },
    },
    clinical: {
      commonErrors: ["ㅈ으로 약화", "ㅊ과 혼동 (기이 세짐)"],
      facilitation: ["속삭임 “짠굴”·“진리” 같은 알력 프레이즈"],
    },
  },

  // ——————————————————————————————————————————————————————————————————
  // 연구개음
  // ——————————————————————————————————————————————————————————————————
  {
    hangul: "ㄱ",
    ipa: "k",
    romanization: "g/k",
    place: "연구개",
    manner: "파열음(평음)",
    priority: "high",
    description: "혁목이 연구개(입천장 뒤계)에 닿았다 떼면서 파열. 뒤소리라 아동이 힘들어함.",
    articulation: {
      tongueTip: { x: 360, y: 290 },
      tongueBody: { x: 300, y: 235 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 303, y: 233, label: "연구개", color: "#fb7185" },
    },
    clinical: {
      commonErrors: [
        "ㄷ으로 전방화 (fronting) — 대표적 조음 오류",
        "ㅌ/ㅈ으로 대치",
      ],
      facilitation: [
        "고개 젝혀서 강제 혁목 뒤쪽 이동 유도",
        "터끍에 손가락 괴고 높이 뒤 팁 업으로 일기",
        "“가금”·“고기” 같은 이음절 조합마다 철저하게 조음 확인",
      ],
    },
  },
  {
    hangul: "ㅋ",
    ipa: "kʰ",
    romanization: "k",
    place: "연구개",
    manner: "파열음(격음)",
    priority: "high",
    description: "ㄱ + 강한 기음.",
    articulation: {
      tongueTip: { x: 360, y: 290 },
      tongueBody: { x: 300, y: 235 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 303, y: 233, label: "연구개 + 기음", color: "#f43f5e" },
    },
    clinical: {
      commonErrors: ["ㄱ과 혼동 (기이 부족)"],
      facilitation: ["종이 휠림 대비, 기의 양 강조"],
    },
  },
  {
    hangul: "ㄲ",
    ipa: "k͈",
    romanization: "kk",
    place: "연구개",
    manner: "파열음(경음)",
    priority: "high",
    description: "경음 연구개. 기이 적고 안력/긴장이 큼.",
    articulation: {
      tongueTip: { x: 360, y: 290 },
      tongueBody: { x: 300, y: 235 },
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 303, y: 233, label: "연구개 긴장", color: "#e11d48" },
    },
    clinical: {
      commonErrors: ["ㄱ으로 약화", "ㅋ과 혼동"],
      facilitation: ["이목이 꿉 닫고 긴장으로 조음 연습"],
    },
  },
  {
    hangul: "ㅇ_종성",
    ipa: "ŋ",
    romanization: "ng (coda)",
    place: "연구개",
    manner: "비음 (종성 전용)",
    priority: "high",
    description: "혁목이 연구개에 닿고 연구개 하강 → 코로 공기. “삽”, “공”.",
    articulation: {
      tongueTip: { x: 360, y: 290 },
      tongueBody: { x: 300, y: 235 },
      velumOpen: true,
      lipClosure: false,
      highlight: { x: 303, y: 233, label: "연구개 — 비음", color: "#facc15" },
    },
    clinical: {
      commonErrors: ["ㄴ으로 전방화 (“당→단”)"],
      facilitation: [
        "ㄱ을 발음하는 움직임을 유지한 채 코 풌린 “음” — 코로 공기 흐르면 [ŋ]",
      ],
    },
  },

  // ——————————————————————————————————————————————————————————————————
  // 성문음
  // ——————————————————————————————————————————————————————————————————
  {
    hangul: "ㅎ",
    ipa: "h",
    romanization: "h",
    place: "성문",
    manner: "마찰음",
    priority: "medium",
    description: "성문에서 공기만 세게 내보냄. 혀 위치는 따르는 모음에 따라 결정.",
    articulation: {
      tongueTip: REST_TIP,
      tongueBody: REST_BODY,
      velumOpen: false,
      lipClosure: false,
      highlight: { x: 225, y: 385, label: "성문", color: "#fde047" },
    },
    clinical: {
      commonErrors: ["생략 (“하늘→아늘”)", "수의르게 될 때 속삭임"],
      facilitation: ["손바닥에 따뜻한 숨이 느껴지도록 긴 “하—” 유지"],
    },
  },
];

export function consonantsByPlace(
  list: KoreanConsonant[] = KOREAN_CONSONANTS,
): Record<string, KoreanConsonant[]> {
  const groups: Record<string, KoreanConsonant[]> = {};
  for (const c of list) {
    if (!groups[c.place]) groups[c.place] = [];
    groups[c.place].push(c);
  }
  return groups;
}
