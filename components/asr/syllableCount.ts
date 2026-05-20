/**
 * 한국어/영어 혼합 텍스트에서 음절 수 추정.
 *
 * 규칙
 *  - 한글 음절 블록 (가–힣, U+AC00–U+D7A3) → 각 1음절
 *  - 한글 자모 (ㄱ–ㅎ, ㅏ–ㅣ) → 각 1음절 (자모 단독 발화 시)
 *  - 영문 단어 → 모음 그룹 (a/e/i/o/u/y 연속군) 수로 추정
 *      · 단어 끝 "e"는 묵음 처리 (단, 모음군이 1개 남는 경우는 유지)
 *      · 모음 0개 단어는 1음절로 카운트
 *  - 아라비아 숫자 → 각 자릿수 = 한국어로 읽을 때 1음절 (영, 일, 이…)
 *  - 그 외 (구두점·공백) → 0
 *
 * 임상 보조용 추정치. ASR 인식 오류와 발화 변동성 때문에
 * 정확도는 ±10% 수준이며, 임상가 검토 후 수기 보정을 권장.
 */

const HANGUL_SYLLABLE = /[가-힣]/g;
const HANGUL_JAMO = /[ㄱ-ㅎㅏ-ㅣ]/g;
const DIGITS = /[0-9]/g;
const ENGLISH_WORD = /[a-zA-Z]+/g;

export function countSyllables(text: string): number {
  if (!text) return 0;

  const hangulCount = (text.match(HANGUL_SYLLABLE) ?? []).length;
  const jamoCount = (text.match(HANGUL_JAMO) ?? []).length;
  const digitCount = (text.match(DIGITS) ?? []).length;

  let englishCount = 0;
  const words = text.match(ENGLISH_WORD) ?? [];
  for (const w of words) {
    englishCount += countEnglishSyllables(w);
  }

  return hangulCount + jamoCount + digitCount + englishCount;
}

function countEnglishSyllables(word: string): number {
  const w = word.toLowerCase();
  if (w.length === 0) return 0;
  // vowel-group counting
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;
  // silent 'e' at end
  if (count > 1 && /e$/.test(w)) count -= 1;
  return Math.max(1, count);
}

/** 통계용: 전사 텍스트를 정리 (다중 공백 제거, 트림). */
export function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
