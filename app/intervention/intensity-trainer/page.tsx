import ComingSoonPage from "@/components/ComingSoonPage";

export default function IntensityTrainerPage() {
  return (
    <ComingSoonPage
      category="🔴 중재 프로그램"
      title="강도 바이오피드백 훈련"
      subtitle="Intensity Biofeedback · 목표 dB 구간 도달"
      color="rose"
      description="대상자가 목표 강도 구간(예: 70–80 dB)에 머문 시간을 최대화하도록 시각 게이지·소림 피드백을 제공하는 훈련. 파킨슨 저강도 특성 개선에 효과."
      features={[
        "음성강도 측정 엔진 공유 (음향분석/강도 모듈)",
        "목표 구간 서래로 드래그 설정",
        "도달 시 시각·청각 피드백 (게이머한 옵션)",
        "세션 결과: 머문 비율 / 평균 dB / 다회기 추세",
      ]}
      references={[
        "Ramig 외 (2001) LSVT LOUD · PD 와 강도 재교육",
      ]}
    />
  );
}
