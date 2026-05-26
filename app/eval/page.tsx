import EvalApp from "@/components/voicelabEval/voicelab_eval_module";

export const metadata = {
  title: "voicelab 평가 모듈 · 지산학 사업",
  description:
    "대림대학교 언어치료학과 · 마인드허브 · 안양시노인종합복지관 지산학 시범사업 — 인지·언어·정서·삶의 질 사전/중간/사후 평가",
};

export default function EvalPage() {
  return <EvalApp />;
}
