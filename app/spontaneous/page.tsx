import SpontaneousClient from "./SpontaneousClient";
import StreamlitFallback from "./StreamlitFallback";

/**
 * 분석 API 가 설정돼 있을 때만 새 검수 UI 를 띄운다.
 * 미설정이면 기존 Streamlit 임베드로 폴백 — 수업 중에 도구가 통째로 죽는 일이 없도록.
 */
export default function SpontaneousPage() {
  const configured = Boolean(
    process.env.SPONTANEOUS_API_URL && process.env.SPONTANEOUS_SECRET,
  );
  return configured ? <SpontaneousClient /> : <StreamlitFallback />;
}
