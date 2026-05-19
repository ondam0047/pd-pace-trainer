import ComingSoonPage from "@/components/ComingSoonPage";

export default function DafPage() {
  return (
    <ComingSoonPage
      category="🔴 중재 프로그램"
      title="DAF 훈련기"
      subtitle="Delayed Auditory Feedback · 지연청각피드백"
      color="rose"
      description="마이크로 들어온 자신의 음성을 50–200ms 지연해 헤드폰으로 되돌려주는 훈련. 말더듬·속해서 말하기 대상자에게 효과적이며 파킨슨 말속도 조절에도 넓게 쓰입니다."
      features={[
        "지연 시간 조정 50–500ms (슬라이더)",
        "파수 변환 (FAF) 옵션 — ±반음정",
        "세션 녹음 · 임상 메모",
        "하울링 경고 — 헤드폰 사용 필수",
      ]}
      references={[
        "Kalinowski & Saltuklaroglu (2003) DAF 지연 시간 권장치",
        "Hanson & Metter (1980) PD 적용 근거",
      ]}
      notes="스피커 출력 시 피드백 루프 위험. 반드시 헤드폰/이어폰 사용."
    />
  );
}
