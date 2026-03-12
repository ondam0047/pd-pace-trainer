export interface PresetTextItem {
  id: string;
  label: string;
  text: string;
}

export const PRESET_TEXTS: PresetTextItem[] = [
  {
    id: "daily-1",
    label: "짧은 일상 1",
    text: "오늘은 천천히 또박또박 말해 볼게요.",
  },
  {
    id: "daily-2",
    label: "짧은 일상 2",
    text: "오늘 기분은 괜찮고 몸도 좀 편한 편이에요.",
  },
  {
    id: "request-1",
    label: "기능적 요청 1",
    text: "물 한 잔 좀 주세요. 지금 목이 좀 말라요.",
  },
  {
    id: "request-2",
    label: "기능적 요청 2",
    text: "잠깐만요. 제가 천천히 다시 말해 볼게요.",
  },
  {
    id: "hospital-1",
    label: "병원 상황",
    text: "요즘 말이 좀 빨라져서 상대방이 잘 못 알아들을 때가 있어요.",
  },
  {
    id: "family-1",
    label: "가족 대화",
    text: "오늘 저녁에 가족이랑 같이 밥 먹으면서 이야기할 거예요.",
  },
  {
    id: "phone-1",
    label: "전화 상황",
    text: "여보세요. 저 지금 가는 중이에요. 조금만 기다려 주세요.",
  },
  {
    id: "long-1",
    label: "긴 문장 1",
    text: "천천히 말하면 듣는 사람이 더 잘 알아듣고, 저도 말하는 속도를 더 편하게 맞출 수 있어요.",
  },
  {
    id: "long-2",
    label: "긴 문장 2",
    text: "말하기 전에 숨을 한 번 고르고 어절마다 나눠서 말하면 속도를 조절하는 데 도움이 돼요.",
  },
];