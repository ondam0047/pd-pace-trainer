"use client";

import { type VoiceQualityResult } from "./analyzer";
import { mdvpRadarSvg } from "./mdvpRadarSvg";

/**
 * MDVP 스타일 방사형(레이더) 다이어그램.
 * 초록 원 = 정상 임계값(비율 1.0). 환자 값이 원 밖(빨강)이면 이상.
 */
export default function MdvpRadar({ result }: { result: VoiceQualityResult }) {
  return (
    <div
      className="w-full select-none"
      dangerouslySetInnerHTML={{ __html: mdvpRadarSvg(result) }}
    />
  );
}
