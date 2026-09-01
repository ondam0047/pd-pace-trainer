"use client";

import { type VoiceQualityResult } from "./analyzer";
import { mdvpRadarSvg } from "./mdvpRadarSvg";

/**
 * MDVP 스타일 방사형(레이더) 다이어그램.
 * 초록 원 = 참고 범위(비율 1.0). 측정값이 원 밖이면 참고 범위를 벗어남.
 */
export default function MdvpRadar({ result }: { result: VoiceQualityResult }) {
  return (
    <div
      className="w-full select-none"
      dangerouslySetInnerHTML={{ __html: mdvpRadarSvg(result) }}
    />
  );
}
