/**
 * voicelab 평가 모듈 — 접근성 설정.
 *
 * 어르신·검사자 모두 태블릿에서 쓰는 상황을 가정해 글씨 확대를 한 줄 바에서
 * 토글하게 한다. 설정은 localStorage 에 저장.
 *
 * 고대비·TTS 음성안내는 현장 피드백상 불필요해서 제거함.
 */

export type FontScale = "base" | "lg" | "xl";

export interface A11ySettings {
  fontScale: FontScale;
}

export const DEFAULT_A11Y: A11ySettings = {
  fontScale: "base",
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
