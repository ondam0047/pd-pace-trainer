/**
 * voicelab 평가 모듈 — 접근성 설정.
 *
 * 어르신·검사자 모두 태블릿에서 쓰는 상황을 가정해 글씨 확대 / 고대비 / 음성 안내(TTS)
 * 세 가지를 한 줄 바에서 토글하게 한다. 설정은 localStorage 에 저장.
 */

export type FontScale = "base" | "lg" | "xl";

export interface A11ySettings {
  fontScale: FontScale;
  highContrast: boolean;
  ttsOn: boolean;
}

export const DEFAULT_A11Y: A11ySettings = {
  fontScale: "base",
  highContrast: false,
  ttsOn: false,
};

const KEY = "voicelab:eval:a11y";

export function loadA11y(): A11ySettings {
  if (typeof window === "undefined") return DEFAULT_A11Y;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_A11Y;
    const parsed = JSON.parse(raw);
    return {
      fontScale: ["base", "lg", "xl"].includes(parsed?.fontScale) ? parsed.fontScale : "base",
      highContrast: !!parsed?.highContrast,
      ttsOn: !!parsed?.ttsOn,
    };
  } catch {
    return DEFAULT_A11Y;
  }
}

export function saveA11y(s: A11ySettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 무시
  }
}

export function fontScaleMultiplier(s: FontScale): number {
  return s === "xl" ? 1.5 : s === "lg" ? 1.25 : 1.0;
}

export function fontScaleLabel(s: FontScale): string {
  return s === "xl" ? "매우 큼" : s === "lg" ? "크게" : "보통";
}

export function nextFontScale(s: FontScale): FontScale {
  return s === "base" ? "lg" : s === "lg" ? "xl" : "base";
}

/**
 * 한국어 TTS 한 번 발화. ttsOn 이 false 면 no-op.
 * 진행 중 다른 발화가 있으면 취소하고 새로 말한다 (이전 안내가 겹치지 않게).
 */
export function speak(text: string, ttsOn: boolean): void {
  if (!ttsOn) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.95;
    u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const ko = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ko"));
    if (ko) u.voice = ko;
    window.speechSynthesis.speak(u);
  } catch {
    // 무시 — TTS 미지원/실패 시 조용히 패스
  }
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // 무시
  }
}
