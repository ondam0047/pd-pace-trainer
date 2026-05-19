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

// 각 대역에서 가장 강한 피크를 선택 — 이전 "첫 피크" 방식은
// 잡음 피크가 F2 자리를 차지하면 진짜 F2가 F3 슬롯으로 넘어가는 문제가 있었음.
// /이/에서 F3만 움직이는 현상의 근본 원인.
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
        (minSepFrom === null || p.f > minSepFrom + 250),
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((max, p) => (p.mag > max.mag ? p : max));
  };

  // F1: 200–1100 Hz (학령전기 아동의 ㅏ ≈ 1050 포함)
  const f1Peak = strongestIn(200, 1100, null);
  const f1 = f1Peak ? f1Peak.f : null;

  // F2: 700–3300 Hz (아동 ㅣ ≈ 3000–3300 포함)
  const f2Peak = strongestIn(700, 3300, f1);
  const f2 = f2Peak ? f2Peak.f : null;

  // F3: 2000–4500 Hz
  const f3Peak = strongestIn(2000, 4500, f2);
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

  // LPC 차수: 전체 대역(0–22kHz)을 충분히 모델하도록 18 사용.
  // 이보다 낮으면(12) 아동 음성에서 F2 피크 구분이 흐릿해지고,
  // 더 높으면(>24) spurious peak이 늘어나서 잘못 골리기 쉬움.
  const order = options?.order ?? 18;

  const pre = preemphasize(buffer);
  const win = hammingWindow(pre);
  const a = lpcAutocorrelation(win, order);
  if (!a) return SILENT;

  const spectrum = lpcSpectrum(a, sampleRate, 2048, maxFreq);
  const peaks = findAllPeaks(spectrum);
  return pickFormants(peaks);
}
