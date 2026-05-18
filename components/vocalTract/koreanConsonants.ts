export type KoreanConsonant = {
  hangul: string;
  ipa: string;
  place: "양순" | "치조" | "경구개" | "연구개" | "성문";
  manner: string;
  tongueTarget: { x: number; y: number } | null;
  lipClosure: boolean;
  velarOcclusion: boolean;
  description: string;
};

// SVG 좌표계(400x400) 기준. 혀 휴지 위치 ~ (270, 290). y가 작을수록 위쪽.
export const KOREAN_CONSONANTS: KoreanConsonant[] = [
  // 양순 (bilabial) - 항상 입술 폐쇄
  {
    hangul: "ㅂ",
    ipa: "p",
    place: "양순",
    manner: "파열음(평음)",
    tongueTarget: null,
    lipClosure: true,
    velarOcclusion: false,
    description: "두 입술을 닫았다 터트리면서 어기는 평음 파열음",
  },
  {
    hangul: "ㅍ",
    ipa: "pʰ",
    place: "양순",
    manner: "파열음(격음)",
    tongueTarget: null,
    lipClosure: true,
    velarOcclusion: false,
    description: "강한 기식(기음)을 동반하는 격음 파열음",
  },
  {
    hangul: "ㅁ",
    ipa: "m",
    place: "양순",
    manner: "비음",
    tongueTarget: null,
    lipClosure: true,
    velarOcclusion: false,
    description: "입술을 닫고 코로 공기가 흐르는 비음",
  },
  // 치조 (alveolar) - 혀끓 치조융기 (윗이 뒤쪽 잊못)
  {
    hangul: "ㄷ",
    ipa: "t",
    place: "치조",
    manner: "파열음(평음)",
    tongueTarget: { x: 318, y: 198 },
    lipClosure: false,
    velarOcclusion: false,
    description: "혀끓을 윗이 뒤 잊못에 대고 떼는 평음 파열음",
  },
  {
    hangul: "ㅌ",
    ipa: "tʰ",
    place: "치조",
    manner: "파열음(격음)",
    tongueTarget: { x: 318, y: 198 },
    lipClosure: false,
    velarOcclusion: false,
    description: "강한 기음을 동반하는 격음 파열음",
  },
  {
    hangul: "ㄴ",
    ipa: "n",
    place: "치조",
    manner: "비음",
    tongueTarget: { x: 318, y: 200 },
    lipClosure: false,
    velarOcclusion: false,
    description: "혀끓이 윗이 뒤에 닿고 코로 공기가 흐르는 비음",
  },
  {
    hangul: "ㄹ",
    ipa: "l / ɾ",
    place: "치조",
    manner: "유음",
    tongueTarget: { x: 313, y: 205 },
    lipClosure: false,
    velarOcclusion: false,
    description: "혀끓을 윗잊못에 이는 유음. 어중간에서는 탄설음[ɾ]",
  },
  {
    hangul: "ㅅ",
    ipa: "s",
    place: "치조",
    manner: "마찰음(평음)",
    tongueTarget: { x: 308, y: 212 },
    lipClosure: false,
    velarOcclusion: false,
    description: "하단·마찰음 훈련의 핵심 자음. 경구개[ɕ]으로 왜곡되기 쉬움",
  },
  {
    hangul: "ㅆ",
    ipa: "s͈",
    place: "치조",
    manner: "마찰음(경음)",
    tongueTarget: { x: 308, y: 212 },
    lipClosure: false,
    velarOcclusion: false,
    description: "긴장된 경음 치조마찰음",
  },
  // 경구개 (palatal) - 혀 앞부분이 경구개에 접근
  {
    hangul: "ㅈ",
    ipa: "tɕ",
    place: "경구개",
    manner: "파찰음(평음)",
    tongueTarget: { x: 285, y: 200 },
    lipClosure: false,
    velarOcclusion: false,
    description: "파열 후 마찰이 연이어지는 평음 파찰음",
  },
  {
    hangul: "ㅊ",
    ipa: "tɕʰ",
    place: "경구개",
    manner: "파찰음(격음)",
    tongueTarget: { x: 285, y: 200 },
    lipClosure: false,
    velarOcclusion: false,
    description: "격음 파찰음",
  },
  // 연구개 (velar) - 혀뒤부분이 연구개 접촉
  {
    hangul: "ㄱ",
    ipa: "k",
    place: "연구개",
    manner: "파열음(평음)",
    tongueTarget: { x: 240, y: 192 },
    lipClosure: false,
    velarOcclusion: true,
    description: "혀뒤가 연구개(입천장 뒤계)에 닿는 평음 파열음",
  },
  {
    hangul: "ㅋ",
    ipa: "kʰ",
    place: "연구개",
    manner: "파열음(격음)",
    tongueTarget: { x: 240, y: 192 },
    lipClosure: false,
    velarOcclusion: true,
    description: "격음 연구개 파열음",
  },
  {
    hangul: "ㅇ",
    ipa: "ŋ",
    place: "연구개",
    manner: "비음 (종성)",
    tongueTarget: { x: 240, y: 195 },
    lipClosure: false,
    velarOcclusion: true,
    description: "종성으로 쓰일 때만 소림값을 가진다. 이은 [ŋ].",
  },
  // 성문 (glottal)
  {
    hangul: "ㅎ",
    ipa: "h",
    place: "성문",
    manner: "마찰음",
    tongueTarget: null,
    lipClosure: false,
    velarOcclusion: false,
    description: "성문에서 소음이 만들어지는 마찰음. 혀 위치는 모음에 따라 결정됨.",
  },
];

export function consonantsByPlace(): Record<string, KoreanConsonant[]> {
  const groups: Record<string, KoreanConsonant[]> = {};
  for (const c of KOREAN_CONSONANTS) {
    if (!groups[c.place]) groups[c.place] = [];
    groups[c.place].push(c);
  }
  return groups;
}
