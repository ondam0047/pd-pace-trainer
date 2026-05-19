import ComingSoonPage from "@/components/ComingSoonPage";

export default function EmfrPage() {
  return (
    <ComingSoonPage
      category="🟢 공기역학 분석"
      title="추정 평균호기류율"
      subtitle="EMFR · Estimated Mean Flow Rate (VC ÷ MPT)"
      color="emerald"
      description="폐활량(VC)을 최대발성지속시간(MPT)으로 나눐 발성 시 평균 호기류을 간접 추정합니다. 성대 고정 이상 이나 호흡 지에 결함을 판별하는 도구."
      features={[
        "VC 값은 수동 입력 (폐결재재훈련 장비 결과 활용)",
        "MPT 결과 자동 불러오기",
        "정상 범위 — 성인 ≈ 100–200 mL/s",
        "과다 (>250 mL/s, 성대마비 의심) / 과소 구분",
      ]}
      references={[
        "Hirano (1981) Clinical Examination of Voice",
        "임상적 권고치: VC 는 철원(spirometry) 필수",
      ]}
      notes="직접 공기류 측정(pneumotachograph)이 아닌 간접 추정치입니다. 우세 온 입술 자세·호흡법 표준화한 후 측정."
    />
  );
}
