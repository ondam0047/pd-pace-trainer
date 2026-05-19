import ComingSoonPage from "@/components/ComingSoonPage";

export default function IntensityPage() {
  return (
    <ComingSoonPage
      category="🔵 음향 분석"
      title="음성강도 측정"
      subtitle="Intensity (dB) · Real-time SPL Meter"
      color="blue"
      description="마이크로 입력되는 음성의 강도(dB)를 실시간으로 측정하고 시계열 그래프로 표시합니다."
      features={[
        "실시간 dB 게이지 (RMS 기반)",
        "시계열 그래프 + 머문 비율",
        "캠리브레이션 톤 입력 옵션 (1kHz 기준 음)",
        "음성강도 변동성(SD) 자동 계산",
      ]}
      notes="캐리브레이션 없이는 상대값으로만 의미가 있으며, 절대값 비교는 보정 소스 입력 후 가능합니다."
    />
  );
}
