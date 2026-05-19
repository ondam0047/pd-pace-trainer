import ComingSoonPage from "@/components/ComingSoonPage";

export default function ArticulationRatePage() {
  return (
    <ComingSoonPage
      category="🟡 말 흐름 분석"
      title="조음속도"
      subtitle="Articulation Rate · 250ms 이상 쉬 제외"
      color="amber"
      description="전체 말속도에서 250ms 이상의 쉬 구간을 제외하고 순수 조음 구간만으로 속도를 계산합니다. 말속도 자체는 느릴 수 있으나 조음 자체는 정상인 경우(예: 파킨슨) 판별에 유용."
      features={[
        "동일 녹음에서 전체말속도 · 조음속도 동시 제공",
        "두 지표의 비 표시 — 렬뜝한 차이 나면 쉬 구간이 많은 경우",
        "VAD 파라미터 (쉬 임계값) 조절 가능",
      ]}
      references={[
        "Tjaden & Wilding (2004) speech rate 추출 방법론",
        "이조구 외 (2017) 한국어 말·조음속도 비교",
      ]}
    />
  );
}
