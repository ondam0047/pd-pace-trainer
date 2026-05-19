import ComingSoonPage from "@/components/ComingSoonPage";

export default function FluencyPage() {
  return (
    <ComingSoonPage
      category="말 흐름"
      title="유창성 분석"
      subtitle="%SS · Disfluency Tagging"
      color="amber"
      description="임상가가 실시간 키보드 키 혹은 버튼으로 비유창 이벤트를 태그하면 자동으로 %SS, 유형별 비율, 말더듬 중증도를 계산합니다."
      features={[
        "비유창 유형 6종 태그: 음절반복 / 단어반복 / 보간적 반복 / 연장 / 막힘 / 수정",
        "%SS (Percentage of Stuttered Syllables) 자동 계산",
        "Riley SSI-4 점수 구조 지원",
        "세션 CSV 내보내기",
      ]}
      references={[
        "Riley (2009) Stuttering Severity Instrument-4",
        "심현섭 (2010) 한국판 파라다이스 유창성 검사",
      ]}
    />
  );
}
