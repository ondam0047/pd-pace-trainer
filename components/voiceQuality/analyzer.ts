import { yinPitch } from "../pitch/yin";

export type VoiceQualityResult = {
  f0Mean: number;
  f0SD: number;
  jitterLocal: number; // %
  jitterRap: number; // %
  shimmerLocal: number; // %
  shimmerApq3: number; // %
  hnr: number; // dB
  validFrames: number;
  durationSec: number;
};

export const EMPTY_RESULT: VoiceQualityResult = {
  f0Mean: 0, f0SD: 0,
  jitterLocal: 0, jitterRap: 0,
  shimmerLocal: 0, shimmerApq3: 0,
  hnr: 0, validFrames: 0, durationSec: 0,
};

export function analyzeVoiceQuality(
  signal: Float32Array,
  sampleRate: number,
  frameSize: number = 2048,
  hopSize: number = 1024,
): VoiceQualityResult {
  const periods: number[] = [];
  const amps: number[] = [];
  const hnrFrames: number[] = [];
  const f0s: number[] = [];

  for (let start = 0; start + frameSize <= signal.length; start += hopSize) {
    const frame = signal.subarray(start, start + frameSize);

    // RMS check - skip silent frames
    let sumSq = 0;
    for (let i = 0; i < frame.length; i++) sumSq += frame[i] * frame[i];
    const rms = Math.sqrt(sumSq / frame.length);
    if (rms < 0.005) continue;

    const f0 = yinPitch(frame, sampleRate);
    if (f0 < 60 || f0 > 500 || !isFinite(f0)) continue;

    const period = sampleRate / f0;
    periods.push(period);
    f0s.push(f0);

    // Peak amplitude in frame
    let maxAbs = 0;
    for (let i = 0; i < frame.length; i++) {
      const a = Math.abs(frame[i]);
      if (a > maxAbs) maxAbs = a;
    }
    amps.push(maxAbs);

    // HNR via period-lag autocorrelation
    const lag = Math.round(period);
    if (lag > 0 && lag < frame.length - 100) {
      let r0 = 0, rL = 0;
      const N = frame.length - lag;
      for (let i = 0; i < N; i++) {
        r0 += frame[i] * frame[i];
        rL += frame[i] * frame[i + lag];
      }
      r0 /= N;
      rL /= N;
      const ratio = r0 > 0 ? rL / r0 : 0;
      const clamped = Math.max(0.001, Math.min(0.999, ratio));
      const hnr = 10 * Math.log10(clamped / (1 - clamped));
      hnrFrames.push(hnr);
    }
  }

  if (periods.length < 3) {
    return { ...EMPTY_RESULT, durationSec: signal.length / sampleRate };
  }

  // F0 stats
  const f0Mean = f0s.reduce((a, b) => a + b, 0) / f0s.length;
  const f0Var = f0s.reduce((a, b) => a + (b - f0Mean) * (b - f0Mean), 0) / f0s.length;
  const f0SD = Math.sqrt(f0Var);
  const periodMean = periods.reduce((a, b) => a + b, 0) / periods.length;
  const ampMean = amps.reduce((a, b) => a + b, 0) / amps.length;

  // Jitter local: mean(|T_i - T_{i+1}|) / mean(T)
  let jSum = 0;
  for (let i = 0; i < periods.length - 1; i++) {
    jSum += Math.abs(periods[i] - periods[i + 1]);
  }
  const jitterLocal = periodMean > 0
    ? (jSum / (periods.length - 1)) / periodMean * 100
    : 0;

  // Jitter RAP: 3-point smoothed
  let rapSum = 0;
  for (let i = 1; i < periods.length - 1; i++) {
    const avg3 = (periods[i - 1] + periods[i] + periods[i + 1]) / 3;
    rapSum += Math.abs(periods[i] - avg3);
  }
  const jitterRap = periods.length > 2 && periodMean > 0
    ? (rapSum / (periods.length - 2)) / periodMean * 100
    : 0;

  // Shimmer local: mean(|A_i - A_{i+1}|) / mean(A) * 100
  let sSum = 0;
  for (let i = 0; i < amps.length - 1; i++) {
    sSum += Math.abs(amps[i] - amps[i + 1]);
  }
  const shimmerLocal = ampMean > 0
    ? (sSum / (amps.length - 1)) / ampMean * 100
    : 0;

  // Shimmer APQ3
  let apq3Sum = 0;
  for (let i = 1; i < amps.length - 1; i++) {
    const avg3 = (amps[i - 1] + amps[i] + amps[i + 1]) / 3;
    apq3Sum += Math.abs(amps[i] - avg3);
  }
  const shimmerApq3 = amps.length > 2 && ampMean > 0
    ? (apq3Sum / (amps.length - 2)) / ampMean * 100
    : 0;

  // HNR mean
  const hnrMean = hnrFrames.length > 0
    ? hnrFrames.reduce((a, b) => a + b, 0) / hnrFrames.length
    : 0;

  return {
    f0Mean,
    f0SD,
    jitterLocal,
    jitterRap,
    shimmerLocal,
    shimmerApq3,
    hnr: hnrMean,
    validFrames: periods.length,
    durationSec: signal.length / sampleRate,
  };
}

// 정상 범위 (Praat 기준, 성인 정상 음성)
export const NORMAL_RANGES = {
  jitterLocal: { normal: 1.04, abnormal: 2.0, unit: "%" },
  jitterRap: { normal: 0.68, abnormal: 1.5, unit: "%" },
  shimmerLocal: { normal: 3.81, abnormal: 6.0, unit: "%" },
  shimmerApq3: { normal: 3.0, abnormal: 5.0, unit: "%" },
  hnr: { normal: 20, abnormal: 15, unit: "dB", reverse: true }, // HNR은 높을수록 정상
};

export function getStatus(
  value: number,
  key: keyof typeof NORMAL_RANGES,
): "normal" | "borderline" | "abnormal" {
  const range = NORMAL_RANGES[key];
  if ("reverse" in range && range.reverse) {
    if (value >= range.normal) return "normal";
    if (value >= range.abnormal) return "borderline";
    return "abnormal";
  }
  if (value <= range.normal) return "normal";
  if (value <= range.abnormal) return "borderline";
  return "abnormal";
}
