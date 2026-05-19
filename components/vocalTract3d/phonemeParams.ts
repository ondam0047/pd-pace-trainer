/**
 * 한국어 자모음 → 절차적 3D 성도 파라미터 매핑.
 *
 * 좌표계: x = 입에서 성문 방향 (-1.0 ~ +1.0, +1 = 입술),
 *         y = 위/아래 (-0.5 ~ +0.8, +0.8 = 경구개),
 *         z = 좌우 (대칭, 0).
 *
 * 파라미터 의미
 *  - tongueBodyX/Y : 혀의 몸체 중심 위치 (조음 위치)
 *  - tongueBodyRadius : 혀 몸체 크기 (모음의 개구도와 연동)
 *  - tongueTipX/Y : 혀끝 위치 (자음에서 활성)
 *  - tongueTipRadius : 혀끝 두께
 *  - lipAperture : 입술 벌림 (0 = 닫힘, 1 = 완전 개구)
 *  - lipProtrusion : 입술 돌출 (원순성, 0~1)
 *  - jawOpen : 턱 벌림 (0~1)
 *  - velumOpen : 연구개 (0 = 닫힘 = 구강음, 1 = 열림 = 비음)
 *  - constrictionPoint : 협착점 표시 (자음의 활성 조음점, 0~1 = 성문~입술)
 *  - constrictionDegree : 협착 강도 (0 = 없음, 1 = 완전 폐쇄)
 *
 * 출처
 *  - Maeda (1990) 'Compensatory articulation during speech'
 *  - Browman & Goldstein (1989) Articulatory Phonology
 *  - 신지영 (2014) 『한국어의 말소리』 조음 위치 정리
 */

export interface PhonemeParams {
  tongueBodyX: number;
  tongueBodyY: number;
  tongueBodyRadius: number;
  tongueTipX: number;
  tongueTipY: number;
  tongueTipRadius: number;
  lipAperture: number;
  lipProtrusion: number;
  jawOpen: number;
  velumOpen: number;
  constrictionPoint: number;
  constrictionDegree: number;
}

export interface PhonemeDef {
  id: string;
  label: string;
  symbol: string;
  group: "vowel" | "stop" | "fricative" | "nasal" | "liquid" | "affricate";
  description: string;
  params: PhonemeParams;
}

const NEUTRAL: PhonemeParams = {
  tongueBodyX: 0.1,
  tongueBodyY: 0.05,
  tongueBodyRadius: 0.28,
  tongueTipX: 0.5,
  tongueTipY: -0.05,
  tongueTipRadius: 0.06,
  lipAperture: 0.3,
  lipProtrusion: 0,
  jawOpen: 0.3,
  velumOpen: 0,
  constrictionPoint: 0,
  constrictionDegree: 0,
};

function v(over: Partial<PhonemeParams>): PhonemeParams {
  return { ...NEUTRAL, ...over };
}

// 한국어 단모음 7종
export const VOWELS: PhonemeDef[] = [
  {
    id: "i",
    label: "이",
    symbol: "/i/",
    group: "vowel",
    description: "고전설 평순 — 혀가 경구개 가까이, 입술 평평",
    params: v({
      tongueBodyX: 0.2,
      tongueBodyY: 0.45,
      tongueBodyRadius: 0.34,
      lipAperture: 0.25,
      lipProtrusion: 0,
      jawOpen: 0.15,
    }),
  },
  {
    id: "e",
    label: "에",
    symbol: "/e/",
    group: "vowel",
    description: "중전설 평순 — 혀가 약간 내려옴",
    params: v({
      tongueBodyX: 0.2,
      tongueBodyY: 0.25,
      tongueBodyRadius: 0.33,
      lipAperture: 0.35,
      lipProtrusion: 0,
      jawOpen: 0.3,
    }),
  },
  {
    id: "a",
    label: "아",
    symbol: "/a/",
    group: "vowel",
    description: "저중설 평순 — 혀가 가장 낮음, 턱 크게 벌림",
    params: v({
      tongueBodyX: 0.05,
      tongueBodyY: -0.15,
      tongueBodyRadius: 0.3,
      lipAperture: 0.7,
      lipProtrusion: 0,
      jawOpen: 0.85,
    }),
  },
  {
    id: "eu",
    label: "으",
    symbol: "/ɯ/",
    group: "vowel",
    description: "고후설 평순 — 혀 몸체가 연구개 부근, 입술 평평",
    params: v({
      tongueBodyX: -0.25,
      tongueBodyY: 0.35,
      tongueBodyRadius: 0.32,
      lipAperture: 0.25,
      lipProtrusion: 0,
      jawOpen: 0.15,
    }),
  },
  {
    id: "o",
    label: "오",
    symbol: "/o/",
    group: "vowel",
    description: "중후설 원순 — 혀 후방, 입술 둥글게",
    params: v({
      tongueBodyX: -0.3,
      tongueBodyY: 0.1,
      tongueBodyRadius: 0.32,
      lipAperture: 0.35,
      lipProtrusion: 0.6,
      jawOpen: 0.4,
    }),
  },
  {
    id: "u",
    label: "우",
    symbol: "/u/",
    group: "vowel",
    description: "고후설 원순 — 혀 후방 가장 높음, 입술 가장 둥글",
    params: v({
      tongueBodyX: -0.35,
      tongueBodyY: 0.4,
      tongueBodyRadius: 0.33,
      lipAperture: 0.2,
      lipProtrusion: 0.85,
      jawOpen: 0.15,
    }),
  },
  {
    id: "eo",
    label: "어",
    symbol: "/ʌ/",
    group: "vowel",
    description: "중후설 평순 — 혀 후방, 입술 평평, 턱 중간",
    params: v({
      tongueBodyX: -0.2,
      tongueBodyY: -0.05,
      tongueBodyRadius: 0.3,
      lipAperture: 0.5,
      lipProtrusion: 0,
      jawOpen: 0.55,
    }),
  },
];

// 한국어 자음 (대표 — 폐쇄, 마찰, 비음, 유음, 파찰)
export const CONSONANTS: PhonemeDef[] = [
  {
    id: "p",
    label: "ㅂ",
    symbol: "/p/",
    group: "stop",
    description: "양순 폐쇄음 — 두 입술이 완전히 닫힘",
    params: v({
      lipAperture: 0,
      lipProtrusion: 0.1,
      jawOpen: 0.1,
      constrictionPoint: 1.0,
      constrictionDegree: 1.0,
    }),
  },
  {
    id: "t",
    label: "ㄷ",
    symbol: "/t/",
    group: "stop",
    description: "치경 폐쇄음 — 혀끝이 윗잇몸에 닿음",
    params: v({
      tongueTipX: 0.7,
      tongueTipY: 0.45,
      tongueTipRadius: 0.08,
      lipAperture: 0.5,
      jawOpen: 0.25,
      constrictionPoint: 0.85,
      constrictionDegree: 1.0,
    }),
  },
  {
    id: "k",
    label: "ㄱ",
    symbol: "/k/",
    group: "stop",
    description: "연구개 폐쇄음 — 혀 뒷부분이 연구개에 닿음",
    params: v({
      tongueBodyX: -0.4,
      tongueBodyY: 0.45,
      tongueBodyRadius: 0.34,
      lipAperture: 0.5,
      jawOpen: 0.3,
      constrictionPoint: 0.25,
      constrictionDegree: 1.0,
    }),
  },
  {
    id: "s",
    label: "ㅅ",
    symbol: "/s/",
    group: "fricative",
    description: "치경 마찰음 — 혀끝과 윗잇몸 사이 좁은 통로",
    params: v({
      tongueTipX: 0.65,
      tongueTipY: 0.35,
      tongueTipRadius: 0.07,
      lipAperture: 0.3,
      jawOpen: 0.2,
      constrictionPoint: 0.85,
      constrictionDegree: 0.75,
    }),
  },
  {
    id: "sh",
    label: "ㅅ(ㅣ앞)",
    symbol: "/ɕ/",
    group: "fricative",
    description: "치경구개 마찰음 — 혀가 경구개 쪽으로 이동",
    params: v({
      tongueBodyX: 0.25,
      tongueBodyY: 0.35,
      tongueBodyRadius: 0.32,
      tongueTipX: 0.55,
      tongueTipY: 0.25,
      tongueTipRadius: 0.07,
      lipAperture: 0.35,
      lipProtrusion: 0.25,
      jawOpen: 0.2,
      constrictionPoint: 0.75,
      constrictionDegree: 0.7,
    }),
  },
  {
    id: "h",
    label: "ㅎ",
    symbol: "/h/",
    group: "fricative",
    description: "성문 마찰음 — 성문에서 마찰, 구강은 열림",
    params: v({
      lipAperture: 0.5,
      jawOpen: 0.4,
      constrictionPoint: 0.02,
      constrictionDegree: 0.5,
    }),
  },
  {
    id: "m",
    label: "ㅁ",
    symbol: "/m/",
    group: "nasal",
    description: "양순 비음 — 입술 폐쇄 + 연구개 열림",
    params: v({
      lipAperture: 0,
      lipProtrusion: 0.1,
      jawOpen: 0.1,
      velumOpen: 1,
      constrictionPoint: 1.0,
      constrictionDegree: 1.0,
    }),
  },
  {
    id: "n",
    label: "ㄴ",
    symbol: "/n/",
    group: "nasal",
    description: "치경 비음 — 혀끝 폐쇄 + 연구개 열림",
    params: v({
      tongueTipX: 0.7,
      tongueTipY: 0.45,
      tongueTipRadius: 0.08,
      lipAperture: 0.5,
      jawOpen: 0.25,
      velumOpen: 1,
      constrictionPoint: 0.85,
      constrictionDegree: 1.0,
    }),
  },
  {
    id: "ng",
    label: "ㅇ(받침)",
    symbol: "/ŋ/",
    group: "nasal",
    description: "연구개 비음 — 혀 뒤가 연구개 폐쇄 + 연구개 열림",
    params: v({
      tongueBodyX: -0.4,
      tongueBodyY: 0.45,
      tongueBodyRadius: 0.34,
      lipAperture: 0.5,
      jawOpen: 0.3,
      velumOpen: 1,
      constrictionPoint: 0.25,
      constrictionDegree: 1.0,
    }),
  },
  {
    id: "l",
    label: "ㄹ",
    symbol: "/l~ɾ/",
    group: "liquid",
    description: "탄설음/설측음 — 혀끝이 잇몸을 가볍게 침/측면 통로",
    params: v({
      tongueTipX: 0.7,
      tongueTipY: 0.4,
      tongueTipRadius: 0.07,
      lipAperture: 0.45,
      jawOpen: 0.3,
      constrictionPoint: 0.85,
      constrictionDegree: 0.6,
    }),
  },
  {
    id: "ch",
    label: "ㅈ",
    symbol: "/tɕ/",
    group: "affricate",
    description: "치경구개 파찰음 — 폐쇄 후 마찰",
    params: v({
      tongueBodyX: 0.2,
      tongueBodyY: 0.3,
      tongueBodyRadius: 0.32,
      tongueTipX: 0.6,
      tongueTipY: 0.3,
      tongueTipRadius: 0.08,
      lipAperture: 0.35,
      lipProtrusion: 0.15,
      jawOpen: 0.2,
      constrictionPoint: 0.75,
      constrictionDegree: 0.85,
    }),
  },
];

export const ALL_PHONEMES = [...VOWELS, ...CONSONANTS];

/** 두 파라미터 셋의 선형 보간 (애니메이션용). */
export function interpolateParams(
  a: PhonemeParams,
  b: PhonemeParams,
  t: number,
): PhonemeParams {
  const k = Math.max(0, Math.min(1, t));
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    tongueBodyX: lerp(a.tongueBodyX, b.tongueBodyX),
    tongueBodyY: lerp(a.tongueBodyY, b.tongueBodyY),
    tongueBodyRadius: lerp(a.tongueBodyRadius, b.tongueBodyRadius),
    tongueTipX: lerp(a.tongueTipX, b.tongueTipX),
    tongueTipY: lerp(a.tongueTipY, b.tongueTipY),
    tongueTipRadius: lerp(a.tongueTipRadius, b.tongueTipRadius),
    lipAperture: lerp(a.lipAperture, b.lipAperture),
    lipProtrusion: lerp(a.lipProtrusion, b.lipProtrusion),
    jawOpen: lerp(a.jawOpen, b.jawOpen),
    velumOpen: lerp(a.velumOpen, b.velumOpen),
    constrictionPoint: lerp(a.constrictionPoint, b.constrictionPoint),
    constrictionDegree: lerp(a.constrictionDegree, b.constrictionDegree),
  };
}

export { NEUTRAL };
