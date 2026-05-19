import ComingSoonPage from "@/components/ComingSoonPage";

export default function BreathingPage() {
  return (
    <ComingSoonPage
      category="🟢 공기역학 분석"
      title="흡기 수 추정"
      subtitle="Breath Group Count · Pause-based Inference"
      color="emerald"
      description="낭독/자유발화 샘플에서 단위 쉬이 구간을 검출해 호흡 단위(breath group) 수를 추정합니다. 호흡 펨도 · 단위그룹 길이를 관리."
      features={[
        "VAD + 히스테리시스로 쉬 구간 자동 분할",
        "호흡 제어 그룹 길이(음절수) 통계",
        "분당 호흡 횟수 (파킨슨·호흡지장애 임상 지표)",
        "차트: 호흡 위치 마커 오버레이",
      ]}
      references={[
        "Hammen & Yorkston (1996) 파킨슨·호흡 지장 운율 연구",
        "이사지·태자 (2014) 한국 아동 낭독 호흡 패턴",
      ]}
    />
  );
}
