import { yinPitch } from "../pitch/yin";

/**
 * MDVP(Multi-Dimensional Voice Program, KayPENTAX) 정렬 음향 파라미터.
 * 프레임 단위(주기 1개/프레임) 근사이므로 MDVP/Praat 본 프로그램과
 * 수치 차이가 있을 수 있음 — 임상 확정은 Praat/MDVP 와 대조 권장.
 *
 * 임계값 근거: MDVP 병리 임계(Jita 83.2µs, Jitt 1.04%, RAP 0.68%,
 *   PPQ 0.84%, vF0 1.10%, ShdB 0.35dB, Shim 3.81%, APQ 3.07%,
 *   vAm 8.2%, NHR 0.19). Boersma & Weenink Praat 매뉴얼 교차확인.
 */
export type VoiceQualityResult = {
  // 기본주파수
  f0Mean: number; // Hz (F0)
  f0Hi: number; // Hz (Fhi)
  f0Lo: number; // Hz (Flo)
  f0SD: number; // Hz (STD)
  pfrSemitones: number; // PFR (음역, semitone)
  vF0: number; // % (F0 변동계수)
  toMs: number; // ms (평균 주기 To)
  // 주파수 변동 (jitter)
  jitaUs: number; // µs (절대 지터)
  jitterLocal: number; // % (Jitt)
  rap: number; // % (RAP, 3점)
  ppq5: number; // % (PPQ, 5점)
  // 진폭 변동 (shimmer)
  shimmerLocal: number; // % (Shim)
  shdB: number; // dB (ShdB)
  apq11: number; // % (APQ, 11점)
  apq3: number; // % (APQ3, 3점)
  vAm: number; // % (진폭 변동계수)
  // 잡음
  nhr: number; // 비율 (NHR)
  hnr: number; // dB (보조)
  validFrames: number;
  durationSec: number;
};

export const EMPTY_RESULT: VoiceQualityResult = {
  f0Mean: 0, f0Hi: 0, f0Lo: 0, f0SD: 0, pfrSemitones: 0, vF0: 0, toMs: 0,
  jitaUs: 0, jitterLocal: 0, rap: 0, ppq5: 0,
  shimmerLocal: 0, shdB: 0, apq11: 0, apq3: 0, vAm: 0,
  nhr: 0, hnr: 0, validFrames: 0, durationSec: 0,
};

function mean(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

// m-점 perturbation quotient (%) : |x_i - mean(x[i-k..i+k])| 평균 / mean(x) * 100
function perturbationQuotient(x: number[], points: number): number {
  const k = (points - 1) / 2;
  if (x.length <= points) return 0;
  const m = mean(x);
  if (m <= 0) return 0;
  let sum = 0;
  let cnt = 0;
  for (let i = k; i < x.length - k; i++) {
    let avg = 0;
    for (let j = i - k; j <= i + k; j++) avg += x[j];
    avg /= points;
    sum += Math.abs(x[i] - avg);
    cnt++;
  }
  return cnt > 0 ? (sum / cnt / m) * 100 : 0;
}

export function analyzeVoiceQuality(
  signal: Float32Array,
  sampleRate: number,
  frameSize: number = 2048,
  hopSize: number = 1024,
): VoiceQualityResult {
  const periods: number[] = []; // samples
  const amps: number[] = []; // peak amplitude
  const f0s: number[] = [];
  const nhrFrames: number[] = [];
  const hnrFrames: number[] = [];

  for (let start = 0; start + frameSize <= signal.length; start += hopSize) {
    const frame = signal.subarray(start, start + frameSize);

    let sumSq = 0;
    for (let i = 0; i < frame.length; i++) sumSq += frame[i] * frame[i];
    const rms = Math.sqrt(sumSq / frame.length);
    if (rms < 0.005) continue;

    const f0 = yinPitch(frame, sampleRate);
    if (f0 < 60 || f0 > 500 || !isFinite(f0)) continue;

    const period = sampleRate / f0;
    periods.push(period);
    f0s.push(f0);

    let maxAbs = 0;
    for (let i = 0; i < frame.length; i++) {
      const a = Math.abs(frame[i]);
      if (a > maxAbs) maxAbs = a;
    }
    amps.push(maxAbs);

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
      hnrFrames.push(10 * Math.log10(clamped / (1 - clamped)));
      nhrFrames.push((1 - clamped) / clamped);
    }
  }

  if (periods.length < 3) {
    return { ...EMPTY_RESULT, durationSec: signal.length / sampleRate };
  }

  const f0Mean = mean(f0s);
  const f0Var = mean(f0s.map((f) => (f - f0Mean) * (f - f0Mean)));
  const f0SD = Math.sqrt(f0Var);
  const f0Hi = Math.max(...f0s);
  const f0Lo = Math.min(...f0s);
  const periodMean = mean(periods);
  const ampMean = mean(amps);

  // 주파수 변동
  let absDiffSum = 0;
  for (let i = 0; i < periods.length - 1; i++) {
    absDiffSum += Math.abs(periods[i] - periods[i + 1]);
  }
  const meanAbsDiffSamples = absDiffSum / (periods.length - 1);
  const jitaUs = (meanAbsDiffSamples / sampleRate) * 1e6;
  const jitterLocal = periodMean > 0 ? (meanAbsDiffSamples / periodMean) * 100 : 0;
  const rap = perturbationQuotient(periods, 3);
  const ppq5 = perturbationQuotient(periods, 5);

  // 진폭 변동
  let shSum = 0;
  for (let i = 0; i < amps.length - 1; i++) {
    shSum += Math.abs(amps[i] - amps[i + 1]);
  }
  const shimmerLocal = ampMean > 0 ? (shSum / (amps.length - 1) / ampMean) * 100 : 0;
  let shdBSum = 0;
  let shdBCnt = 0;
  for (let i = 0; i < amps.length - 1; i++) {
    if (amps[i] > 0 && amps[i + 1] > 0) {
      shdBSum += Math.abs(20 * Math.log10(amps[i] / amps[i + 1]));
      shdBCnt++;
    }
  }
  const shdB = shdBCnt > 0 ? shdBSum / shdBCnt : 0;
  const apq3 = perturbationQuotient(amps, 3);
  const apq11 = perturbationQuotient(amps, 11);
  const ampSD = Math.sqrt(mean(amps.map((a) => (a - ampMean) * (a - ampMean))));
  const vAm = ampMean > 0 ? (ampSD / ampMean) * 100 : 0;

  return {
    f0Mean,
    f0Hi,
    f0Lo,
    f0SD,
    pfrSemitones: f0Lo > 0 ? 12 * Math.log2(f0Hi / f0Lo) : 0,
    vF0: f0Mean > 0 ? (f0SD / f0Mean) * 100 : 0,
    toMs: (periodMean / sampleRate) * 1000,
    jitaUs,
    jitterLocal,
    rap,
    ppq5,
    shimmerLocal,
    shdB,
    apq11,
    apq3,
    vAm,
    nhr: mean(nhrFrames),
    hnr: mean(hnrFrames),
    validFrames: periods.length,
    durationSec: signal.length / sampleRate,
  };
}

// MDVP 병리 임계값 (이 값을 초과하면 이상)
export const MDVP_THRESHOLDS = {
  jitaUs: 83.2,
  jitterLocal: 1.04,
  rap: 0.68,
  ppq5: 0.84,
  vF0: 1.1,
  shdB: 0.35,
  shimmerLocal: 3.81,
  apq11: 3.07,
  vAm: 8.2,
  nhr: 0.19,
} as const;

export type MdvpKey = keyof typeof MDVP_THRESHOLDS;

export function getStatus(
  value: number,
  key: MdvpKey,
): "normal" | "abnormal" {
  return value <= MDVP_THRESHOLDS[key] ? "normal" : "abnormal";
}

// HNR 은 MDVP 항목은 아니나 보조 지표 (높을수록 정상)
export const HNR_NORMAL = 20;
export function getHnrStatus(value: number): "normal" | "abnormal" {
  return value >= HNR_NORMAL ? "normal" : "abnormal";
}
