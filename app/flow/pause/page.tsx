import ComingSoonPage from "@/components/ComingSoonPage";

export default function PausePage() {
  return (
    <ComingSoonPage
      category="🟡 말 흐름 분석"
      title="쉬 구간 분석"
      subtitle="Pause Frequency / Duration"
      color="amber"
      description="발화 중 쉬의 위치·길이·빈도를 자동 검출해 일람표와 히스토그램으로 제공합니다. 어휘 인출 결함·주저을 정량화하는 지표."
      features={[
        "쉬 길이 분포 히스토그램",
        "장쉬(>250ms) / 단쉬 분류",
        "분당 쉬 횟수 + 쉬-발화 비율",
        "잘못된 위치의 쉬(intra-word pause) 태그",
      ]}
      references={[
        "공경희 외 (2018) 말더듬 아동의 쉬 패턴",
      ]}
    />
  );
}
