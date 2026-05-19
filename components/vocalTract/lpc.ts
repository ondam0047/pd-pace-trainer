// 자기상관 기반 LPC + Levinson-Durbin 재귀
// 음성 포먼트 추정을 위한 수치적 기본을 제공하는 단축 구현이다.

export function preemphasize(
  signal: Float32Array,
  alpha = 0.97,
): Float32Array {
  const out = new Float32Array(signal.length);
  out[0] = signal[0];
  for (let i = 1; i < signal.length; i++) {
    out[i] = signal[i] - alpha * signal[i - 1];
  }
  return out;
}

export function hammingWindow(signal: Float32Array): Float32Array {
  const N = signal.length;
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
    out[i] = signal[i] * w;
  }
  return out;
}

// a[0] = 1, a[1..order] = LPC 계수
// 실패(무효 입력) 시 null 반환
export function lpcAutocorrelation(
  signal: Float32Array,
  order: number,
): Float32Array | null {
  const r = new Float32Array(order + 1);
  for (let lag = 0; lag <= order; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < signal.length; i++) {
      sum += signal[i] * signal[i + lag];
    }
    r[lag] = sum;
  }
  if (r[0] <= 1e-9) return null;

  const a = new Float32Array(order + 1);
  a[0] = 1;
  let e = r[0];

  for (let i = 1; i <= order; i++) {
    let acc = 0;
    for (let j = 1; j < i; j++) {
      acc += a[j] * r[i - j];
    }
    const k = -(r[i] + acc) / e;

    const newA = new Float32Array(i + 1);
    newA[0] = 1;
    for (let j = 1; j < i; j++) {
      newA[j] = a[j] + k * a[i - j];
    }
    newA[i] = k;
    for (let j = 0; j <= i; j++) a[j] = newA[j];

    e = (1 - k * k) * e;
    if (e <= 0) return null;
  }

  return a;
}

// nFreqs 포인트에서 |1/A(e^{jω})| 평가
export function lpcSpectrum(
  a: Float32Array,
  sampleRate: number,
  nFreqs: number,
  maxFreq?: number,
): { f: number; mag: number }[] {
  const order = a.length - 1;
  const upper = Math.min(maxFreq ?? sampleRate / 2, sampleRate / 2);
  const result: { f: number; mag: number }[] = new Array(nFreqs);
  for (let n = 0; n < nFreqs; n++) {
    const f = (n / (nFreqs - 1)) * upper;
    const omega = (2 * Math.PI * f) / sampleRate;
    let re = 0;
    let im = 0;
    for (let k = 0; k <= order; k++) {
      const ang = -k * omega;
      re += a[k] * Math.cos(ang);
      im += a[k] * Math.sin(ang);
    }
    const mag2 = re * re + im * im + 1e-12;
    result[n] = { f, mag: 1 / Math.sqrt(mag2) };
  }
  return result;
}
