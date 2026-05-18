"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VocalTractDiagram from "./vocalTract/VocalTractDiagram";
import VowelChart from "./vocalTract/VowelChart";
import { estimateFormants } from "./vocalTract/formants";
import { findClosestVowel, type VowelGender } from "./vocalTract/koreanVowels";

const EMA_ALPHA = 0.6;

export default function VocalTractVisualizer() {
  const [isRecording, setIsRecording] = useState(false);
  const [gender, setGender] = useState<VowelGender>("female");
  const [f1, setF1] = useState<number | null>(null);
  const [f2, setF2] = useState<number | null>(null);
  const [f3, setF3] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef<{
    f1: number | null;
    f2: number | null;
    f3: number | null;
  }>({ f1: null, f2: null, f3: null });

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    sourceRef.current = null;
    smoothRef.current = { f1: null, f2: null, f3: null };
    setIsRecording(false);
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    const result = estimateFormants(buf, ctx.sampleRate);
    const sm = smoothRef.current;

    const ema = (prev: number | null, cur: number | null): number | null => {
      if (cur === null) return prev;
      if (prev === null) return cur;
      return EMA_ALPHA * prev + (1 - EMA_ALPHA) * cur;
    };

    sm.f1 = ema(sm.f1, result.f1);
    sm.f2 = ema(sm.f2, result.f2);
    sm.f3 = ema(sm.f3, result.f3);

    setF1(sm.f1);
    setF2(sm.f2);
    setF3(sm.f3);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;
      source.connect(analyser);

      smoothRef.current = { f1: null, f2: null, f3: null };
      setF1(null);
      setF2(null);
      setF3(null);
      setIsRecording(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "마이크 접근에 실패했습니다. 브라우저 권한을 확인해주세요.",
      );
    }
  }, [tick]);

  useEffect(() => () => stop(), [stop]);

  const closest = useMemo(() => {
    if (f1 === null || f2 === null) return null;
    return findClosestVowel(f1, f2, gender);
  }, [f1, f2, gender]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            참조 화자
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {(["male", "female"] as VowelGender[]).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  g === gender
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {g === "male" ? "성인 남성" : "성인 여성"}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {!isRecording ? (
            <button
              onClick={start}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              발성 시작
            </button>
          ) : (
            <button
              onClick={stop}
              className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              정지
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            측면 성도 단면도
          </h3>
          <VocalTractDiagram f1={f1} f2={f2} />
          <p className="mt-2 text-xs text-slate-500">
            F1·F2에 따라 혀의 정점(위·아래·앞·뒤) 위치가 자동으로 이동합니다.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            F1 / F2 모음 사각도
          </h3>
          <VowelChart f1={f1} f2={f2} gender={gender} />
          <p className="mt-2 text-xs text-slate-500">
            파란 원이 한국어 8단모음의 표준 위치, 빨간 점이 현재 위치입니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReadBox label="F1" value={f1} />
        <ReadBox label="F2" value={f2} />
        <ReadBox label="F3" value={f3} />
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
            가장 가까운 모음
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-900">
            {closest ? `${closest.vowel.hangul} /${closest.vowel.ipa}/` : "-"}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            {closest
              ? `${closest.vowel.features} · 거리 ${closest.distance.toFixed(1)} mel`
              : "발성을 시작하세요"}
          </p>
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          분석 방법 · 근거 자료
        </summary>
        <div className="mt-3 space-y-2 text-xs text-slate-600">
          <p>
            <strong>포먼트 추정:</strong> 입력 신호 → pre-emphasis(α=0.97) → Hamming
            윈도우 → 자기상관 LPC + Levinson-Durbin → LPC 스펙트럼 → 피크 추출 →
            F1·F2·F3.
          </p>
          <p>
            <strong>한국어 단모음 표준값:</strong> 이호영(1996)
            «국어 음성학», 신지영(2014) «말소리의 이해», 박한상(2003)
            한국어 모음 분석 연구의 평균값을 참고했습니다. 화자별 ±15%
            변동성을 보입니다.
          </p>
          <p>
            <strong>거리 측정:</strong> F1·F2 둘 다 mel scale로 변환 후 유클리드
            거리. 사람 청각의 비선형성을 반영합니다.
          </p>
          <p>
            <strong>알려진 한계:</strong> 자음 추정은 미구현(향후 추가). 마찰음·파열음
            같은 비주기성 신호에서는 결과 신뢰도 낮음. 매우 낮은 F1(&lt;250Hz)에서
            정확도 떨어짐.
          </p>
        </div>
      </details>
    </div>
  );
}

function ReadBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-violet-900">
        {value !== null ? `${value.toFixed(0)} Hz` : "-"}
      </p>
    </div>
  );
}
