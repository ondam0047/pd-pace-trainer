"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnatomicalDiagram, {
  type ArticulationState,
} from "./vocalTract/AnatomicalDiagram";
import VowelChart from "./vocalTract/VowelChart";
import { estimateFormants } from "./vocalTract/formants";
import {
  KOREAN_VOWELS,
  findClosestVowel,
  type VowelReference,
} from "./vocalTract/koreanVowels";
import {
  clearCalibration,
  clearVowelTarget,
  getTargets,
  loadCalibration,
  setVowelTarget,
  type VowelCalibration,
} from "./vocalTract/calibration";

const EMA_ALPHA = 0.6;

// F1/F2 → PNG 배경 viewBox 887×1024 좌표로 매핑
function formantsToArticulation(
  f1: number | null,
  f2: number | null,
): ArticulationState | undefined {
  if (f1 === null || f2 === null) return undefined;
  // F1 200 (고모음) → bodyY 560, F1 1100 (저모음) → bodyY 770
  const f1Norm = Math.max(0, Math.min(1, (f1 - 200) / (1100 - 200)));
  const bodyY = 560 + f1Norm * 210;
  // F2 700 (후설) → bodyX 360, F2 3000 (전설) → bodyX 680
  const f2Norm = Math.max(0, Math.min(1, (f2 - 700) / (3000 - 700)));
  const bodyX = 360 + f2Norm * 320;
  const tipX = bodyX + 90;
  const tipY = bodyY - 30;
  return {
    tongueBody: { x: bodyX, y: bodyY },
    tongueTip: { x: tipX, y: tipY },
    velumOpen: false,
    lipClosure: false,
    airflow: "none",
  };
}

const REFERENCE_OPTIONS: { id: VowelReference; label: string }[] = [
  { id: "male", label: "성인 남성" },
  { id: "female", label: "성인 여성" },
  { id: "preschool", label: "학령전기" },
];

export default function VocalTractVisualizer() {
  const [isRecording, setIsRecording] = useState(false);
  const [reference, setReference] = useState<VowelReference>("male");
  const [f1, setF1] = useState<number | null>(null);
  const [f2, setF2] = useState<number | null>(null);
  const [f3, setF3] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<VowelCalibration>({});
  const [showLabels, setShowLabels] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef<{
    f1: number | null;
    f2: number | null;
    f3: number | null;
  }>({ f1: null, f2: null, f3: null });

  useEffect(() => {
    setCalibration(loadCalibration());
  }, []);

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

  const targets = useMemo(
    () => getTargets(calibration, reference),
    [calibration, reference],
  );
  const calibratedSet = useMemo(
    () => new Set(Object.keys(calibration)),
    [calibration],
  );

  const closest = useMemo(() => {
    if (f1 === null || f2 === null) return null;
    return findClosestVowel(f1, f2, reference);
  }, [f1, f2, reference]);

  const articulation = useMemo(
    () => formantsToArticulation(f1, f2),
    [f1, f2],
  );

  const handleCalibrate = (hangul: string) => {
    if (f1 === null || f2 === null) return;
    const c = setVowelTarget(hangul, { f1, f2 });
    setCalibration({ ...c });
  };

  const handleClearOne = (hangul: string) => {
    const c = clearVowelTarget(hangul);
    setCalibration({ ...c });
  };

  const handleClearAll = () => {
    clearCalibration();
    setCalibration({});
  };

  const handleDragTarget = (hangul: string, newF1: number, newF2: number) => {
    const c = setVowelTarget(hangul, { f1: newF1, f2: newF2 });
    setCalibration({ ...c });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">표준 참조</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {REFERENCE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setReference(opt.id)}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  opt.id === reference
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          해부 라벨
        </label>
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            측면 성도 단면도
          </h3>
          <div className="min-w-[440px]">
            <AnatomicalDiagram
              state={articulation}
              showLabels={showLabels}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            F1·F2 값에 따라 빨간 마커(혁끓) + 주황 마커(혁목)이 실시간으로
            이동. 자음 선택 시에는 연구개 · 입술 · 공기 흐름 애니메이션이 오버레이.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            F1/F2 모음 사각도
          </h3>
          <div className="min-w-[420px]">
            <VowelChart
              f1={f1}
              f2={f2}
              targets={targets}
              calibratedSet={calibratedSet}
              onDragTarget={handleDragTarget}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            파란 원 = 표준 위치, 녹색 원 = 캐리브레이션된 위치. 원을 끌어 직접
            수정할 수 있습니다.
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">개인 캐리브레이션</h3>
            <p className="mt-1 text-xs text-slate-500">
              대상자가 해당 모음을 지속하는 동안 버튼을 눌러 지금의 F1·F2를 저장합니다.
              저장된 값은 녹색 원으로 표시되며 다음 회기부터 개인 기준으로 사용됩니다.
            </p>
          </div>
          <button
            onClick={handleClearAll}
            disabled={calibratedSet.size === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            전체 초기화
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {KOREAN_VOWELS.map((v) => {
            const isCalibrated = calibratedSet.has(v.hangul);
            const stored = calibration[v.hangul];
            return (
              <div
                key={v.hangul}
                className={`rounded-lg border p-2 text-center ${
                  isCalibrated
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="text-2xl font-bold text-slate-900">
                  {v.hangul}
                </div>
                <button
                  onClick={() => handleCalibrate(v.hangul)}
                  disabled={f1 === null || f2 === null}
                  className="mt-1 w-full rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                >
                  지금 저장
                </button>
                {isCalibrated && stored && (
                  <>
                    <p className="mt-1 text-[10px] text-emerald-700">
                      F1 {stored.f1.toFixed(0)} · F2 {stored.f2.toFixed(0)}
                    </p>
                    <button
                      onClick={() => handleClearOne(v.hangul)}
                      className="mt-0.5 text-[10px] text-slate-500 underline hover:text-rose-600"
                    >
                      제거
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
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
