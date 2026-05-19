import ComingSoonPage from "@/components/ComingSoonPage";

export default function SpeakingRatePage() {
  return (
    <ComingSoonPage
      category="🟡 말 흐름 분석"
      title="전체 말속도"
      subtitle="Overall Speaking Rate (SPS / WPM)"
      color="amber"
      description="녹음에서 주어진 자료의 전체 발화 시간과 음절수를 이용해 초당 음절수(SPS) · 분당 단어수(WPM)를 계산합니다."
      features={[
        "이전 PD Pace Trainer SPS 엔진 공유",
        "장르별 정상 범위: 낭독 4.5–6.0 SPS / 자유발화 3.5–5.0 SPS",
        "자동 음절 카운트 (실험적, G2P + forced alignment 후 활성)",
        "다회기 추세 그래프",
      ]}
      references={[
        "신문자 (2008) 성인 낭독 속도 규범자료",
        "Yorkston 외 (2010) 운동직장애 말속도 임상 지표",
      ]}
    />
  );
}
