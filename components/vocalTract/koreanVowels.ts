export type VowelGender = "male" | "female";

export type KoreanVowel = {
  hangul: string;
  ipa: string;
  romanization: string;
  features: string;
  formants: {
    male: { f1: number; f2: number };
    female: { f1: number; f2: number };
  };
};

// 한국어 단모음 8개 F1/F2 표준값 (성인 화자 평균)
// 참고:
//   - 이호영 (1996), 국어 음성학, 태학사
//   - 신지영 (2014), 말소리의 이해, 한국문화사
//   - 박한상 (2003), 한국어 모음의 음성학적 분석
// 화자와 발화 스타일에 따라 ±15% 변동 가능
export const KOREAN_VOWELS: KoreanVowel[] = [
  {
    hangul: "ㅣ",
    ipa: "i",
    romanization: "i",
    features: "전설 · 고모음 · 평순",
    formants: { male: { f1: 290, f2: 2240 }, female: { f1: 335, f2: 2670 } },
  },
  {
    hangul: "ㅔ",
    ipa: "e",
    romanization: "e",
    features: "전설 · 중고모음 · 평순",
    formants: { male: { f1: 440, f2: 1900 }, female: { f1: 535, f2: 2230 } },
  },
  {
    hangul: "ㅐ",
    ipa: "ɛ",
    romanization: "ae",
    features: "전설 · 중저모음 · 평순",
    formants: { male: { f1: 580, f2: 1640 }, female: { f1: 720, f2: 1980 } },
  },
  {
    hangul: "ㅏ",
    ipa: "a",
    romanization: "a",
    features: "중설 · 저모음 · 평순",
    formants: { male: { f1: 720, f2: 1240 }, female: { f1: 930, f2: 1490 } },
  },
  {
    hangul: "ㅓ",
    ipa: "ʌ",
    romanization: "eo",
    features: "후설 · 중모음 · 평순",
    formants: { male: { f1: 510, f2: 870 }, female: { f1: 680, f2: 1070 } },
  },
  {
    hangul: "ㅗ",
    ipa: "o",
    romanization: "o",
    features: "후설 · 중고모음 · 원순",
    formants: { male: { f1: 430, f2: 770 }, female: { f1: 520, f2: 900 } },
  },
  {
    hangul: "ㅜ",
    ipa: "u",
    romanization: "u",
    features: "후설 · 고모음 · 원순",
    formants: { male: { f1: 325, f2: 770 }, female: { f1: 385, f2: 950 } },
  },
  {
    hangul: "ㅡ",
    ipa: "ɯ",
    romanization: "eu",
    features: "후설 · 고모음 · 평순",
    formants: { male: { f1: 370, f2: 1430 }, female: { f1: 420, f2: 1670 } },
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
  gender: VowelGender,
): { vowel: KoreanVowel; distance: number } | null {
  if (!isFinite(f1) || !isFinite(f2) || f1 <= 0 || f2 <= 0) return null;
  let best: KoreanVowel = KOREAN_VOWELS[0];
  let bestDist = Infinity;
  for (const v of KOREAN_VOWELS) {
    const target = v.formants[gender];
    const d = formantDistance(f1, f2, target.f1, target.f2);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return { vowel: best, distance: bestDist };
}
