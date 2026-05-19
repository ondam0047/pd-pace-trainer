import ComingSoonPage from "@/components/ComingSoonPage";

export default function MptPage() {
  return (
    <ComingSoonPage
      category="🟢 공기역학 분석"
      title="최대발성지속시간"
      subtitle="MPT · Maximum Phonation Time"
      color="emerald"
      description="깊이 숨을 들이마시고 “아—”를 최대한 길게 발성하는 시간을 자동 측정합니다. 호흡·발성 효율의 기초 지표."
      features={[
        "VAD(음성 활동 감지) 기반 자동 종료 검출",
        "3회 반복 평균 자동 계산",
        "적은 나이·성별 정상 범위 비교",
        "결과는 공기역학 EMFR 계산에 자동 전달",
      ]}
      references={[
        "아동 7세 남: 9–16초 / 여: 8–14초 (보은아 외 2023)",
        "성인 남: 25–35초 / 여: 15–25초",
      ]}
    />
  );
}
