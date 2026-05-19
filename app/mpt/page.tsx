import ComingSoonPage from "@/components/ComingSoonPage";

export default function MptPage() {
  return (
    <ComingSoonPage
      category="호흡·발성 효율"
      title="MPT — 최대발성지속시간"
      subtitle="Maximum Phonation Time · 3회 평균"
      color="emerald"
      description="깊이 숨을 들이마시고 “아—”를 최대한 길게 발성하는 시간을 3회 자동 측정해 평균값을 산출합니다. 호흡·발성 효율의 기초 임상 지표."
      features={[
        "VAD 기반 자동 종료 검출 (손으로 시작·종료 조작 불필요)",
        "①②③ 3회 서으로 반복 춝정 → 평균·최대값 자동 산출",
        "각 회 파형 + 지속시간 관험 가능",
        "성별·나이별 정상 범위 비교",
        "다회기 추세 그래프",
      ]}
      references={[
        "아동 7세 남: 9–16초 / 여: 8–14초 (보은아 외 2023)",
        "성인 남: 25–35초 / 여: 15–25초",
      ]}
    />
  );
}
