import ComingSoonPage from "@/components/ComingSoonPage";

export default function SpeechRatePage() {
  return (
    <ComingSoonPage
      category="말 흐름"
      title="말속도 분석"
      subtitle="Speech Rate Suite — 녹음 → 자동 분석"
      color="amber"
      description="대상자가 낭독/자유발화를 한 번 녹음하면 3가지 말 흐름 지표가 자동으로 산출됩니다. VAD로 쉬 구간을 자동 분할해 하나의 녹음에서 전체말속도 · 조음속도 · 쉬 구간 분석을 동시 제공."
      features={[
        "① 전체말속도 (SPS / WPM) — 전체 발화 시간 기반",
        "② 조음속도 (250ms 이상 쉬 제외) — 순수 조음 구간만",
        "③ 쉬 구간 분포 — 장쉬/단쉬 구분 + 길이 히스토그램",
        "녹음 한 번으로 세 지표 동시 산출 (교차 해석 가능)",
        "음절 자동 카운트 (실험적) / 수동 교정 지원",
      ]}
      references={[
        "신문자 (2008) 성인 낭독 속도 규범자료",
        "Yorkston 외 (2010) 운동직장애 말속도 임상 지표",
        "Tjaden & Wilding (2004) speech/articulation rate 추출",
        "공경희 외 (2018) 아동 쉬 패턴",
      ]}
      notes="3개 지표는 동일한 녹음에서 산출되므로 교차 해석이 가능합니다. 예: 조음속도는 정상이나 전체속도가 느리면 쉬가 많은 경우(파킨슨 의심)."
    />
  );
}
