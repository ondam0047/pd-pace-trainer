import {
  preemphasize,
  hammingWindow,
  lpcAutocorrelation,
  lpcSpectrum,
} from "./lpc";

export type FormantEstimate = {
  f1: number | null;
  f2: number | null;
  f3: number | null;
};

const SILENT: FormantEstimate = { f1: null, f2: null, f3: null };

function findAllPeaks(
  spectrum: { f: number; mag: number }[],
): { f: number; mag: number }[] {
  const peaks: { f: number; mag: number }[] = [];
  for (let i = 1; i < spectrum.length - 1; i++) {
    const cur = spectrum[i].mag;
    if (cur > spectrum[i - 1].mag && cur > spectrum[i + 1].mag) {
      peaks.push(spectrum[i]);
    }
  }
  return peaks;
}

// 주파수 대역별로 F1/F2/F3 선택 — 대역을 벗어난 잡음 피크가 F2 자리를
// 차지하지 않도록 함. 현장에서 "F2가 안 잡힌다"는 증상 해소.
function pickFormants(
  peaks: { f: number; mag: number }[],
): FormantEstimate {
  let f1: number | null = null;
  let f2: number | null = null;
  let f3: number | null = null;
  for (const p of peaks) {
    if (f1 === null && p.f >= 200 && p.f <= 1000) {
      f1 = p.f;
      continue;
    }
    if (
      f2 === null &&
      p.f >= 700 &&
      p.f <= 3000 &&
      (f1 === null || p.f > f1 + 200)
    ) {
      f2 = p.f;
      continue;
    }
    if (
      f3 === null &&
      p.f >= 2000 &&
      p.f <= 4500 &&
      (f2 === null || p.f > f2 + 300)
    ) {
      f3 = p.f;
      continue;
    }
    if (f1 !== null && f2 !== null && f3 !== null) break;
  }
  return { f1, f2, f3 };
}

export function estimateFormants(
  buffer: Float32Array,
  sampleRate: number,
  options?: { rmsThreshold?: number; order?: number; maxFreq?: number },
): FormantEstimate {
  const rmsThreshold = options?.rmsThreshold ?? 0.005;
  const maxFreq = options?.maxFreq ?? 5500;

  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSq / buffer.length);
  if (rms < rmsThreshold) return SILENT;

  // Praat 권장과 유사: order ≈ 2 × (기대 포먼트 수) + 2. 5 포먼트 → ~12.
  // 이전 값(20)은 과합합으로 스펙트럼에 스퓸리어스 피크를 만들어 F2를 가리는 문제.
  const order = options?.order ?? 12;

  const pre = preemphasize(buffer);
  const win = hammingWindow(pre);
  const a = lpcAutocorrelation(win, order);
  if (!a) return SILENT;

  const spectrum = lpcSpectrum(a, sampleRate, 2048, maxFreq);
  const peaks = findAllPeaks(spectrum);
  return pickFormants(peaks);
}
