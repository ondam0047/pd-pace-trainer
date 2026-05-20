import { KOREAN_VOWELS, type VowelGender } from "./koreanVowels";

export type VowelTarget = { f1: number; f2: number };
export type VowelCalibration = Record<string, VowelTarget>;

const STORAGE_KEY = "voiceLab.vowelCalibration.v1";

export function loadCalibration(): VowelCalibration {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as VowelCalibration)
      : {};
  } catch {
    return {};
  }
}

export function saveCalibration(c: VowelCalibration): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function clearCalibration(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function setVowelTarget(
  hangul: string,
  target: VowelTarget,
): VowelCalibration {
  const c = loadCalibration();
  c[hangul] = target;
  saveCalibration(c);
  return c;
}

export function clearVowelTarget(hangul: string): VowelCalibration {
  const c = loadCalibration();
  delete c[hangul];
  saveCalibration(c);
  return c;
}

// 캐리브레이션이 있으면 그걸, 없으면 표준값(gender별)을 반환
export function getTargets(
  calibration: VowelCalibration,
  gender: VowelGender,
): Record<string, VowelTarget> {
  const out: Record<string, VowelTarget> = {};
  for (const v of KOREAN_VOWELS) {
    out[v.hangul] = calibration[v.hangul] ?? v.formants[gender];
  }
  return out;
}
