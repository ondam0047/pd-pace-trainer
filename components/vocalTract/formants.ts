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

// 각 대역에서 가장 강한 피크를 선택 — "첫 피크" 방식에서
// 잡음 피크가 F2 자리를 대신 차지하지 않도록 함.
function pickFormants(
  peaks: { f: number; mag: number }[],
): FormantEstimate {
  const strongestIn = (
    low: number,
    high: number,
    minSepFrom: number | null,
  ): { f: number; mag: number } | null => {
    const candidates = peaks.filter(
      (p) =>
        p.f >= low &&
        p.f <= high &&
        (minSepFrom === null || p.f > minSepFrom + 200),
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((max, p) => (p.mag > max.mag ? p : max));
  };

  // F1: 150–1200 Hz (아동 저모음 다소 높은 F1, 성인 남성 /i/ 의 매우 낮은 F1 모두 컴버)
  const f1Peak = strongestIn(150, 1200, null);
  const f1 = f1Peak ? f1Peak.f : null;

  // F2: 700–3400 Hz (아동 ㅣ ≈ 3000–3300 포함)
  const f2Peak = strongestIn(700, 3400, f1);
  const f2 = f2Peak ? f2Peak.f : null;

  // F3: 2000–4800 Hz
  const f3Peak = strongestIn(2000, 4800, f2);
  const f3 = f3Peak ? f3Peak.f : null;

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

  // LPC 차수: 16. 이보다 높으면(>20) spurious peak, 낮으면(<14) F1·F2 분리 어려움.
  const order = options?.order ?? 16;

  const pre = preemphasize(buffer);
  const win = hammingWindow(pre);
  const a = lpcAutocorrelation(win, order);
  if (!a) return SILENT;

  const spectrum = lpcSpectrum(a, sampleRate, 2048, maxFreq);
  const peaks = findAllPeaks(spectrum);
  return pickFormants(peaks);
}
