/**
 * 한국어판 음성장애지수 (Korean Voice Handicap Index, K-VHI-30)
 * 30문항 · 3개 하위척도(기능 F · 신체 P · 정서 E) 각 10문항 · 0~4 리커트.
 * 근거: Jacobson 외 (1997) Am J Speech Lang Pathol 6:66-70 /
 *       김재옥 외 (2007) 음성과학 14:111-125 (한국어 표준화).
 */
export type Subscale = "F" | "P" | "E";

export interface VhiItem {
  n: number; // 1~30 (원 문항 번호)
  sub: Subscale;
  text: string;
}

// 문항 1~30 (번호순). 각 문항의 하위척도는 원판 기준.
export const VHI_ITEMS: VhiItem[] = [
  { n: 1, sub: "F", text: "다른 사람들이 내 목소리 때문에 내 말을 알아듣기 어려워한다." },
  { n: 2, sub: "P", text: "말할 때 숨이 찬다." },
  { n: 3, sub: "F", text: "시끄러운 공간에서는 사람들이 내 말을 이해하기 어려워한다." },
  { n: 4, sub: "P", text: "내 목소리는 하루 중에도 변한다." },
  { n: 5, sub: "F", text: "집 안에서 가족을 부를 때 가족들이 내 말을 알아듣기 힘들어한다." },
  { n: 6, sub: "F", text: "전화통화를 하고 싶지만 피하게 된다." },
  { n: 7, sub: "E", text: "내 목소리 때문에 다른 사람들에게 말할 때 긴장하게 된다." },
  { n: 8, sub: "F", text: "내 목소리 때문에 사람들이 많은 곳에 가는 것을 꺼리는 경향이 있다." },
  { n: 9, sub: "E", text: "사람들이 내 목소리를 거슬려 한다." },
  { n: 10, sub: "P", text: "사람들은 내게 “목소리에 무슨 문제 있어요?” 라고 물어본다." },
  { n: 11, sub: "F", text: "내 목소리 때문에 친구, 이웃이나 친척들과 상대적으로 덜 이야기한다." },
  { n: 12, sub: "F", text: "얼굴을 마주보고 말할 때에도 상대방이 내 말을 못 알아듣고, 내게 반복해달라고 한다." },
  { n: 13, sub: "P", text: "내 목소리가 갈라지고 탁하게 들린다." },
  { n: 14, sub: "P", text: "목소리를 내기 위해 힘을 줘야 된다고 느낀다." },
  { n: 15, sub: "E", text: "다른 사람들이 내 목소리 문제를 잘 이해해 주지 못한다." },
  { n: 16, sub: "F", text: "내 목소리 때문에 나의 일상생활이나 사회생활에 어려움을 겪는다." },
  { n: 17, sub: "P", text: "내 목소리가 언제 명료하게 들릴지 예측하기 힘들다." },
  { n: 18, sub: "P", text: "내 목소리를 변화시키기 위해 노력한 적이 있다." },
  { n: 19, sub: "F", text: "내 목소리 때문에 대화에 끼어들지 못한다는 느낌을 갖는다." },
  { n: 20, sub: "P", text: "나는 말할 때 많은 노력이 필요하다." },
  { n: 21, sub: "P", text: "저녁에 내 목소리가 더 나빠진다." },
  { n: 22, sub: "F", text: "내 목소리로 인해 내 수입에 영향을 받는다." },
  { n: 23, sub: "E", text: "내 목소리 문제 때문에 화가 난다." },
  { n: 24, sub: "E", text: "내 목소리 문제 때문에 덜 외향적이다." },
  { n: 25, sub: "E", text: "내 목소리로 인해 나는 장애가 있다고 느낀다." },
  { n: 26, sub: "P", text: "말하는 도중에 내 목소리가 “지쳐가서” 나오지 않을 때도 있다." },
  { n: 27, sub: "E", text: "사람들이 다시 말을 해 달라고 할 때마다 괴롭다." },
  { n: 28, sub: "E", text: "사람들이 다시 말을 해 달라고 할 때마다 당황스럽다." },
  { n: 29, sub: "E", text: "내 목소리로 인해 무능력하다고 느낀다." },
  { n: 30, sub: "E", text: "내 목소리 장애가 부끄럽다." },
];

// 0~4 리커트 라벨
export const VHI_SCALE: { value: number; label: string }[] = [
  { value: 0, label: "한번도 없다" },
  { value: 1, label: "거의 없다" },
  { value: 2, label: "때때로" },
  { value: 3, label: "거의 항상" },
  { value: 4, label: "항상" },
];

export const SUBSCALE_LABEL: Record<Subscale, string> = {
  F: "기능 (Functional)",
  P: "신체 (Physical)",
  E: "정서 (Emotional)",
};

export interface VhiResult {
  f: number;
  p: number;
  e: number;
  total: number;
  severity: string;
}

// 중증도 구분 — 선별 절단점(≈15)과 경도/중등도/중도 표준 구간 기반
export function vhiSeverity(total: number): string {
  if (total <= 14) return "정상";
  if (total <= 30) return "살짝 좋지 않음";
  if (total <= 60) return "좋지 않음";
  return "심각함";
}

export function computeVhi(answers: (number | null)[]): VhiResult {
  let f = 0, p = 0, e = 0;
  for (const item of VHI_ITEMS) {
    const a = answers[item.n - 1] ?? 0;
    if (item.sub === "F") f += a;
    else if (item.sub === "P") p += a;
    else e += a;
  }
  const total = f + p + e;
  return { f, p, e, total, severity: vhiSeverity(total) };
}
