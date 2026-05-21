/**
 * 음향 기반 비유창(disfluency) 자동 탐지 — ASR 없이 파형 직접 분석.
 *
 * 탐지 대상
 *  - prolongation (연장): 정상상태 스펙트럼이 비정상적으로 길게 유지
 *      (예: "내애애애애가") → 프레임 간 스펙트럼 변화(flux)가 낮은 긴 구간
 *  - repetition (반복): 짧은 음향 단위가 연속 반복
 *      (예: "내내내내내가") → 인접 음절핵의 log-mel 코사인 유사도가 높음
 *  - block (막힘): 발화 도중 짧은 묵음 + 급격한 재개시
 *      (예: "내/가") → 발화 사이 묵음 갭 + 직후 RMS 급상승
 *
 * ⚠ 임상 보조용 후보 탐지기입니다. 정확도에 한계가 있으며
 *   (특히 잡음·빠른 정상 발화에서 오탐) 반드시 임상가가 청취 확인 후
 *   채택/기각해야 합니다. 클라우드 ASR 은 비유창을 제거하므로 이 작업에
 *   부적합 — 그래서 파형을 직접 분석합니다.
 *
 * 근거: Howell & Sackin (1995) 음향 기반 말더듬 탐지,
 *       Logan & Conture (1995) 비유창 음향 특성,
 *       심현섭 (2010) P-FA-II 비유창 분류 (AD/ND).
 */

export type DisfluencyKind = "prolongation" | "repetition" | "block";

export interface DetectedDisfluency {
  kind: DisfluencyKind;
  start: number; // sec
  end: number; // sec
  confidence: number; // 0~1
  detail: string;
}

interface FrameFeatures {
  time: number;
  rms: number;
  logMel: Float32Array;
}

// ---------- FFT (radix-2, in-place) ----------

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** in-place iterative radix-2 Cooley-Tukey. re/im length must be power of 2. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe;
        im[i + k + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// ---------- Mel filterbank ----------

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}
function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

function buildMelFilterbank(
  fftSize: number,
  sampleRate: number,
  numBands: number,
  fMin = 80,
  fMax = 8000,
): Float32Array[] {
  const nBins = fftSize / 2;
  const melMin = hzToMel(fMin);
  const melMax = hzToMel(Math.min(fMax, sampleRate / 2));
  const points = new Array(numBands + 2)
    .fill(0)
    .map((_, i) => melMin + ((melMax - melMin) * i) / (numBands + 1));
  const binFreqs = points.map((m) => (melToHz(m) * fftSize) / sampleRate);
  const filters: Float32Array[] = [];
  for (let b = 1; b <= numBands; b++) {
    const f = new Float32Array(nBins);
    const left = binFreqs[b - 1];
    const center = binFreqs[b];
    const right = binFreqs[b + 1];
    for (let k = 0; k < nBins; k++) {
      let w = 0;
      if (k >= left && k <= center) w = (k - left) / (center - left || 1);
      else if (k > center && k <= right) w = (right - k) / (right - center || 1);
      f[k] = Math.max(0, w);
    }
    filters.push(f);
  }
  return filters;
}

// ---------- Frame feature extraction ----------

function extractFrames(
  signal: Float32Array,
  sampleRate: number,
  numMel = 26,
): FrameFeatures[] {
  const frameSize = nextPow2(Math.round(sampleRate * 0.025)); // ~25ms
  const hop = Math.round(sampleRate * 0.01); // 10ms
  const filterbank = buildMelFilterbank(frameSize, sampleRate, numMel);
  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frameSize - 1)); // Hamming
  }

  const frames: FrameFeatures[] = [];
  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);

  for (let start = 0; start + frameSize <= signal.length; start += hop) {
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = signal[start + i];
      sumSq += s * s;
      re[i] = s * window[i];
      im[i] = 0;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    fft(re, im);

    const nBins = frameSize / 2;
    const power = new Float32Array(nBins);
    for (let k = 0; k < nBins; k++) power[k] = re[k] * re[k] + im[k] * im[k];

    const logMel = new Float32Array(numMel);
    for (let b = 0; b < numMel; b++) {
      const filt = filterbank[b];
      let e = 0;
      for (let k = 0; k < nBins; k++) e += filt[k] * power[k];
      logMel[b] = Math.log(e + 1e-10);
    }
    frames.push({ time: start / sampleRate, rms, logMel });
  }
  return frames;
}

// ---------- Helpers ----------

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function spectralFlux(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const idx = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))),
  );
  return sorted[idx];
}

// ---------- Detectors ----------

function detectProlongations(
  frames: FrameFeatures[],
  voiceThreshold: number,
): DetectedDisfluency[] {
  const out: DetectedDisfluency[] = [];
  if (frames.length < 3) return out;

  // 프레임 간 flux → 5프레임(≈50ms) 이동평균으로 미세 jitter 완화
  const rawFlux: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    rawFlux.push(spectralFlux(frames[i].logMel, frames[i - 1].logMel));
  }
  const flux = rawFlux.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= 0 && j < rawFlux.length) {
        s += rawFlux[j];
        c++;
      }
    }
    return s / c;
  });

  const voicedFlux = flux.filter((f, i) => frames[i].rms > voiceThreshold);
  if (voicedFlux.length === 0) return out;
  // 정상상태 임계: 평균 flux 의 일정 비율 (전이점은 평균을 끌어올려
  // 견고; percentile 0.25 는 정상상태가 많으면 0 으로 붕괴함).
  const meanFlux =
    voicedFlux.reduce((s, f) => s + f, 0) / voicedFlux.length;
  const lowFluxThresh = meanFlux * 0.7;

  const MIN_DURATION = 0.35; // 350ms 이상
  const hop =
    frames.length > 1 ? frames[1].time - frames[0].time : 0.01;
  const MAX_GAP_FRAMES = Math.round(0.06 / hop); // 60ms 까지 일시 이탈 허용

  let runStart = -1;
  let gap = 0;
  const closeRun = (endIdx: number) => {
    if (runStart < 0) return;
    const dur = frames[endIdx].time - frames[runStart].time;
    if (dur >= MIN_DURATION) {
      out.push({
        kind: "prolongation",
        start: frames[runStart].time,
        end: frames[endIdx].time,
        confidence: Math.min(1, dur / 0.8),
        detail: `정상상태 ${(dur * 1000).toFixed(0)}ms 유지`,
      });
    }
    runStart = -1;
    gap = 0;
  };

  for (let i = 1; i < frames.length; i++) {
    const steady = frames[i].rms > voiceThreshold && flux[i] <= lowFluxThresh;
    if (steady) {
      if (runStart < 0) runStart = i;
      gap = 0;
    } else if (runStart >= 0) {
      // 히스테리시스: 짧은 이탈은 무시, 길어지면 run 종료
      gap++;
      if (gap > MAX_GAP_FRAMES || frames[i].rms <= voiceThreshold) {
        closeRun(i - gap);
      }
    }
  }
  closeRun(frames.length - 1);
  return out;
}

function detectRepetitions(
  frames: FrameFeatures[],
  voiceThreshold: number,
): DetectedDisfluency[] {
  const out: DetectedDisfluency[] = [];
  if (frames.length < 5) return out;

  // 에너지 곡선 스무딩 → 음절핵(피크) 분할
  const rms = frames.map((f) => f.rms);
  const smooth = rms.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= 0 && j < rms.length) {
        s += rms[j];
        c++;
      }
    }
    return s / c;
  });

  const hop = frames.length > 1 ? frames[1].time - frames[0].time : 0.01;
  const minSep = Math.max(2, Math.round(0.06 / hop)); // 피크 최소 간격 60ms
  const halfWin = Math.max(1, Math.round(0.035 / hop)); // 핵 윈도 ±35ms

  // 음절핵 = 에너지 국소 최대(peak-picking). 골이 아닌 피크 기준이라
  // 빠른 반복(내내내, 골이 얕음)에 견고하고, 지속 모음(연장, 내부 피크
  // 없음)은 단일 핵으로 잡혀 반복으로 오탐되지 않음.
  const peaks: number[] = [];
  for (let k = 1; k < smooth.length - 1; k++) {
    if (
      smooth[k] > voiceThreshold &&
      smooth[k] >= smooth[k - 1] &&
      smooth[k] > smooth[k + 1]
    ) {
      if (peaks.length === 0 || k - peaks[peaks.length - 1] >= minSep) {
        peaks.push(k);
      } else if (smooth[k] > smooth[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = k; // 최소 간격 내 더 높은 피크로 교체
      }
    }
  }
  const nuclei = peaks.map((p) => ({
    start: Math.max(0, p - halfWin),
    peak: p,
    end: Math.min(frames.length, p + halfWin),
  }));

  // 인접 음절핵 비교 — 가깝고(<350ms 간격) 유사도 높으면 반복.
  // log-mel 의 평균을 빼서(스펙트럼 기울기 제거) 포먼트 '형태' 차이를
  // 강조 → 서로 다른 모음을 반복으로 오탐하는 것을 줄임 (CMN 유사).
  const avgMel = (n: { start: number; end: number }) => {
    const dim = frames[0].logMel.length;
    const acc = new Float32Array(dim);
    let c = 0;
    for (let k = n.start; k < n.end; k++) {
      for (let b = 0; b < dim; b++) acc[b] += frames[k].logMel[b];
      c++;
    }
    if (c > 0) for (let b = 0; b < dim; b++) acc[b] /= c;
    let mean = 0;
    for (let b = 0; b < dim; b++) mean += acc[b];
    mean /= dim;
    for (let b = 0; b < dim; b++) acc[b] -= mean;
    return acc;
  };

  // 인접 두 피크 사이의 골(최저 에너지)이 더 작은 피크의 일정 비율보다
  // 낮아야 '서로 다른 음절 단위'로 인정 → 지속 모음(연장)의 에너지
  // 잔물결이 만든 가짜 피크를 반복으로 오탐하지 않음 (조음 리셋 검증).
  const hasArticulatoryDip = (p1: number, p2: number): boolean => {
    let minE = Infinity;
    for (let k = p1; k <= p2; k++) minE = Math.min(minE, smooth[k]);
    const dipRef = Math.min(smooth[p1], smooth[p2]);
    return minE < dipRef * 0.6;
  };

  const SIM_THRESH = 0.93;
  const MAX_PERIOD_SEC = 0.35; // 인접 핵 간격 상한 (반복은 빠름)
  let g = 0;
  while (g < nuclei.length - 1) {
    let groupEnd = g;
    for (let h = g + 1; h < nuclei.length; h++) {
      const period =
        frames[nuclei[h].peak].time - frames[nuclei[h - 1].peak].time;
      const sim = cosineSim(avgMel(nuclei[h]), avgMel(nuclei[h - 1]));
      const dip = hasArticulatoryDip(nuclei[h - 1].peak, nuclei[h].peak);
      if (sim > SIM_THRESH && period <= MAX_PERIOD_SEC && dip) {
        groupEnd = h;
      } else break;
    }
    if (groupEnd - g >= 1) {
      // 2회 이상 연속 유사 단위 = 반복
      const count = groupEnd - g + 1;
      out.push({
        kind: "repetition",
        start: frames[nuclei[g].start].time,
        end: frames[Math.min(frames.length - 1, nuclei[groupEnd].end - 1)].time,
        confidence: Math.min(1, (count - 1) / 3),
        detail: `유사 음절 ${count}회 연속`,
      });
      g = groupEnd + 1;
    } else {
      g++;
    }
  }
  return out;
}

function detectBlocks(
  frames: FrameFeatures[],
  voiceThreshold: number,
): DetectedDisfluency[] {
  const out: DetectedDisfluency[] = [];
  if (frames.length < 5) return out;
  const silenceThresh = voiceThreshold * 0.5;

  const totalDur = frames[frames.length - 1].time;
  let i = 0;
  while (i < frames.length) {
    if (frames[i].rms < silenceThresh) {
      let j = i;
      while (j < frames.length && frames[j].rms < silenceThresh) j++;
      const gapStart = frames[i].time;
      const gapEnd = frames[Math.min(j, frames.length - 1)].time;
      const gapDur = gapEnd - gapStart;

      // 발화 내부 갭만 (양옆에 발화), 너무 길지 않게 (정상 쉼 제외)
      const hasSpeechBefore = i > 0 && frames[i - 1].rms > voiceThreshold;
      const hasSpeechAfter = j < frames.length && frames[j].rms > voiceThreshold;
      const notEdge = gapStart > 0.3 && gapEnd < totalDur - 0.3;

      // 막힘은 낱말 내 짧은 묵음(≈100–450ms). 450ms 초과는 정상/문법적
      // 쉼일 가능성이 높아 제외 (오탐 감소).
      if (
        hasSpeechBefore &&
        hasSpeechAfter &&
        notEdge &&
        gapDur >= 0.1 &&
        gapDur <= 0.45
      ) {
        // 직후 RMS 급상승 = 막힘 해제(burst)
        let onset = 0;
        if (j + 2 < frames.length) {
          onset = frames[j + 1].rms - frames[j].rms;
        }
        const abrupt = onset > voiceThreshold * 0.8;
        if (abrupt) {
          out.push({
            kind: "block",
            start: gapStart,
            end: gapEnd,
            confidence: Math.min(1, gapDur / 0.5),
            detail: `발화 내 묵음 ${(gapDur * 1000).toFixed(0)}ms + 급격 재개시`,
          });
        }
      }
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

// ---------- Public API ----------

export function detectDisfluencies(
  signal: Float32Array,
  sampleRate: number,
): DetectedDisfluency[] {
  const frames = extractFrames(signal, sampleRate);
  if (frames.length === 0) return [];

  // 적응형 보이스 임계값: RMS 분포 기반
  const rmsValues = frames.map((f) => f.rms);
  const noiseFloor = percentile(rmsValues, 0.2);
  const peak = percentile(rmsValues, 0.95);
  const voiceThreshold = Math.max(0.008, noiseFloor + (peak - noiseFloor) * 0.15);

  const events = [
    ...detectProlongations(frames, voiceThreshold),
    ...detectRepetitions(frames, voiceThreshold),
    ...detectBlocks(frames, voiceThreshold),
  ];
  events.sort((a, b) => a.start - b.start);
  return events;
}

export const KIND_LABEL: Record<DisfluencyKind, string> = {
  prolongation: "연장",
  repetition: "반복",
  block: "막힘",
};

// 음향 탐지 종류 → P-FA-II 유형 코드
//  - 반복(음절 단위) → 반복2 (R2, 비정상적 비유창)
//  - 연장·막힘 → 비운율적 발성 (DP, 비정상적 비유창)
export const KIND_TO_TAG: Record<DisfluencyKind, string> = {
  prolongation: "DP",
  repetition: "R2",
  block: "DP",
};
