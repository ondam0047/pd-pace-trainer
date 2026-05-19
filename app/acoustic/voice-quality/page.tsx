import ComingSoonPage from "@/components/ComingSoonPage";

export default function VoiceQualityPage() {
  return (
    <ComingSoonPage
      category="🔵 음향 분석"
      title="음질 분석"
      subtitle="Voice Quality · Jitter / Shimmer / HNR"
      color="blue"
      description="주기 변동성(jitter), 진폭 변동성(shimmer), 배음 대 잡음 비(HNR) 을 자동 추출해 음성 장애 여부·중증도를 정량화합니다."
      features={[
        "jitter — local, RAP, PPQ5",
        "shimmer — local, APQ3, APQ5",
        "HNR (Harmonics-to-Noise Ratio)",
        "정상 범위 표시 + Z-score",
        "다회기 추세 비교",
      ]}
      references={[
        "Praat (Boersma & Weenink) 계산식",
        "보은아 외 (2023) 『음성 평가』 임상 그룹 정상치",
      ]}
      notes="브라우저 단독으로는 계산 신뢰도가 낮아 추후 parselmouth 백엔드 API 연동 예정."
    />
  );
}
