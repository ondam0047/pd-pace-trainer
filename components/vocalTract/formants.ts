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

function findSpectrumPeaks(
  spectrum: { f: number; mag: number }[],
  minFreq: number,
  maxFreq: number,
  minSpacing = 80,
): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < spectrum.length - 1; i++) {
    const { f, mag } = spectrum[i];
    if (f < minFreq || f > maxFreq) continue;
    if (mag > spectrum[i - 1].mag && mag > spectrum[i + 1].mag) {
      if (peaks.length === 0 || f - peaks[peaks.length - 1] > minSpacing) {
        peaks.push(f);
      }
    }
  }
  return peaks;
}

export function estimateFormants(
  buffer: Float32Array,
  sampleRate: number,
  options?: { rmsThreshold?: number; order?: number; maxFreq?: number },
): FormantEstimate {
  const rmsThreshold = options?.rmsThreshold ?? 0.005;
  const maxFreq = options?.maxFreq ?? 5000;

  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSq / buffer.length);
  if (rms < rmsThreshold) return SILENT;

  const order =
    options?.order ?? Math.min(20, Math.floor(sampleRate / 1000) + 4);

  const pre = preemphasize(buffer);
  const win = hammingWindow(pre);
  const a = lpcAutocorrelation(win, order);
  if (!a) return SILENT;

  const spectrum = lpcSpectrum(a, sampleRate, 1024, maxFreq);
  const peaks = findSpectrumPeaks(spectrum, 90, maxFreq, 80);

  return {
    f1: peaks[0] ?? null,
    f2: peaks[1] ?? null,
    f3: peaks[2] ?? null,
  };
}
