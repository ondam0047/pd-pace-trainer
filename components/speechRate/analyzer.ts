export type Segment = {
  start: number;
  end: number;
  type: "speech" | "pause";
};

export type SpeechRateResult = {
  totalDuration: number;
  speechDuration: number;
  pauseDuration: number;
  segments: Segment[];
  pauseCount: number;
  longPauseCount: number;
  meanPauseDuration: number;
  maxPauseDuration: number;
};

export function analyzeSpeechRate(
  signal: Float32Array,
  sampleRate: number,
  options?: {
    threshold?: number;
    minPauseMs?: number;
    longPauseMs?: number;
  },
): SpeechRateResult {
  const threshold = options?.threshold ?? 0.012;
  const minPauseMs = options?.minPauseMs ?? 100;
  const longPauseMs = options?.longPauseMs ?? 250;

  const frameSize = Math.round(sampleRate * 0.025);
  const hopSize = Math.round(sampleRate * 0.01);

  const frameTimes: number[] = [];
  const isVoiced: boolean[] = [];
  for (let start = 0; start + frameSize <= signal.length; start += hopSize) {
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = signal[start + i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    frameTimes.push(start / sampleRate);
    isVoiced.push(rms > threshold);
  }

  if (isVoiced.length === 0) {
    return {
      totalDuration: signal.length / sampleRate,
      speechDuration: 0,
      pauseDuration: 0,
      segments: [],
      pauseCount: 0,
      longPauseCount: 0,
      meanPauseDuration: 0,
      maxPauseDuration: 0,
    };
  }

  // Initial segmentation by frame state changes
  const raw: Segment[] = [];
  let curType: "speech" | "pause" = isVoiced[0] ? "speech" : "pause";
  let curStartIdx = 0;
  for (let i = 1; i < isVoiced.length; i++) {
    const t = isVoiced[i] ? "speech" : "pause";
    if (t !== curType) {
      raw.push({
        start: frameTimes[curStartIdx],
        end: frameTimes[i],
        type: curType,
      });
      curType = t;
      curStartIdx = i;
    }
  }
  raw.push({
    start: frameTimes[curStartIdx],
    end: signal.length / sampleRate,
    type: curType,
  });

  // Merge short pauses (<minPauseMs) into surrounding speech
  const filtered: Segment[] = [];
  for (const seg of raw) {
    const durMs = (seg.end - seg.start) * 1000;
    if (
      seg.type === "pause" &&
      durMs < minPauseMs &&
      filtered.length > 0 &&
      filtered[filtered.length - 1].type === "speech"
    ) {
      filtered[filtered.length - 1].end = seg.end;
    } else if (
      filtered.length > 0 &&
      filtered[filtered.length - 1].type === seg.type
    ) {
      filtered[filtered.length - 1].end = seg.end;
    } else {
      filtered.push({ ...seg });
    }
  }

  // Drop leading/trailing pause (silence before first speech and after last speech)
  while (filtered.length > 0 && filtered[0].type === "pause") filtered.shift();
  while (
    filtered.length > 0 &&
    filtered[filtered.length - 1].type === "pause"
  )
    filtered.pop();

  const speechSegs = filtered.filter((s) => s.type === "speech");
  const pauseSegs = filtered.filter((s) => s.type === "pause");

  const totalDuration =
    filtered.length > 0
      ? filtered[filtered.length - 1].end - filtered[0].start
      : 0;
  const speechDuration = speechSegs.reduce(
    (s, x) => s + (x.end - x.start),
    0,
  );
  const pauseDuration = pauseSegs.reduce(
    (s, x) => s + (x.end - x.start),
    0,
  );
  const longPauseCount = pauseSegs.filter(
    (x) => (x.end - x.start) * 1000 >= longPauseMs,
  ).length;
  const meanPauseDuration =
    pauseSegs.length > 0 ? pauseDuration / pauseSegs.length : 0;
  const maxPauseDuration =
    pauseSegs.length > 0
      ? Math.max(...pauseSegs.map((x) => x.end - x.start))
      : 0;

  return {
    totalDuration,
    speechDuration,
    pauseDuration,
    segments: filtered,
    pauseCount: pauseSegs.length,
    longPauseCount,
    meanPauseDuration,
    maxPauseDuration,
  };
}
