export type VowelReference = "male" | "female" | "preschool";
export type VowelGender = VowelReference;

export type KoreanVowel = {
  hangul: string;
  ipa: string;
  romanization: string;
  features: string;
  formants: {
    male: { f1: number; f2: number };
    female: { f1: number; f2: number };
    preschool: { f1: number; f2: number };
  };
};

// 한국어 단모음 7개 (ㅣ/ㅔ[=ㅐ]/ㅏ/ㅡ/ㅗ/ㅜ/ㅓ)
// 성인 남성: 교수님 본인 측정값 (캐리브레이션용 기준)
// 성인 여성: 이호영(1996), 신지영(2014) 평균
// 학령전기: 이재선·박지원(2010), 김미진·이혜은(2014) 평균
export const KOREAN_VOWELS: KoreanVowel[] = [
  {
    hangul: "ㅣ",
    ipa: "i",
    romanization: "i",
    features: "전설 · 고모음 · 평순",
    formants: {
      male: { f1: 221, f2: 2449 },
      female: { f1: 335, f2: 2670 },
      preschool: { f1: 440, f2: 3050 },
    },
  },
  {
    hangul: "ㅔ",
    ipa: "e",
    romanization: "e (에/애 포함)",
    features: "전설 · 중모음 · 평순",
    formants: {
      male: { f1: 601, f2: 2112 },
      female: { f1: 535, f2: 2230 },
      preschool: { f1: 620, f2: 2550 },
    },
  },
  {
    hangul: "ㅏ",
    ipa: "ɑ",
    romanization: "a",
    features: "중설 · 저모음 · 평순",
    formants: {
      male: { f1: 734, f2: 800 },
      female: { f1: 930, f2: 1490 },
      preschool: { f1: 1050, f2: 1700 },
    },
  },
  {
    hangul: "ㅡ",
    ipa: "ɨ",
    romanization: "eu",
    features: "중설 · 고모음 · 평순",
    formants: {
      male: { f1: 255, f2: 1430 },
      female: { f1: 420, f2: 1670 },
      preschool: { f1: 480, f2: 1850 },
    },
  },
  {
    hangul: "ㅗ",
    ipa: "o",
    romanization: "o",
    features: "후설 · 중고모음 · 원순",
    formants: {
      male: { f1: 272, f2: 860 },
      female: { f1: 520, f2: 900 },
      preschool: { f1: 600, f2: 1050 },
    },
  },
  {
    hangul: "ㅜ",
    ipa: "u",
    romanization: "u",
    features: "후설 · 고모음 · 원순",
    formants: {
      male: { f1: 263, f2: 1616 },
      female: { f1: 385, f2: 950 },
      preschool: { f1: 440, f2: 1100 },
    },
  },
  {
    hangul: "ㅓ",
    ipa: "ə",
    romanization: "eo",
    features: "중설 · 중모음 · 평순",
    formants: {
      male: { f1: 399, f2: 1155 },
      female: { f1: 680, f2: 1070 },
      preschool: { f1: 780, f2: 1200 },
    },
  },
];

export function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

export function formantDistance(
  f1a: number,
  f2a: number,
  f1b: number,
  f2b: number,
): number {
  const dF1 = hzToMel(f1a) - hzToMel(f1b);
  const dF2 = hzToMel(f2a) - hzToMel(f2b);
  return Math.sqrt(dF1 * dF1 + dF2 * dF2);
}

export function findClosestVowel(
  f1: number,
  f2: number,
  reference: VowelReference,
): { vowel: KoreanVowel; distance: number } | null {
  if (!isFinite(f1) || !isFinite(f2) || f1 <= 0 || f2 <= 0) return null;
  let best: KoreanVowel = KOREAN_VOWELS[0];
  let bestDist = Infinity;
  for (const v of KOREAN_VOWELS) {
    const target = v.formants[reference];
    const d = formantDistance(f1, f2, target.f1, target.f2);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return { vowel: best, distance: bestDist };
}
