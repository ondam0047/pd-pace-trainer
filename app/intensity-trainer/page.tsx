import { redirect } from "next/navigation";

// 강도 바이오피드백은 실시간 피치·강도 모듈(/pitch)로 통합됨.
export default function IntensityTrainerPage() {
  redirect("/pitch");
}
