"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const MIN_DELAY_MS = 50;
const MAX_DELAY_MS = 500;
const DEFAULT_DELAY_MS = 200;
const PRESET_DELAYS = [50, 100, 150, 200, 250] as const;

export default function DafPage() {
  const [isActive, setIsActive] = useState(false);
  const [delayMs, setDelayMs] = useState(DEFAULT_DELAY_MS);
  const [volume, setVolume] = useState(0.7);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => undefined); audioCtxRef.current = null; }
    sourceRef.current = null;
    delayNodeRef.current = null;
    gainNodeRef.current = null;
    setIsActive(false);
  }, []);

  const start = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = delayMs / 1000;
      delayNodeRef.current = delay;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      gainNodeRef.current = gain;
      source.connect(delay);
      delay.connect(gain);
      gain.connect(ctx.destination);
      startTimeRef.current = performance.now();
      setElapsedSec(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSec((performance.now() - startTimeRef.current) / 1000);
      }, 100);
      setIsActive(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근 실패. 브라우저 권한을 확인해주세요.");
    }
  }, [delayMs, volume]);

  useEffect(() => {
    if (delayNodeRef.current && audioCtxRef.current) {
      delayNodeRef.current.delayTime.setValueAtTime(delayMs / 1000, audioCtxRef.current.currentTime);
    }
  }, [delayMs]);

  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
    }
  }, [volume]);

  useEffect(() => () => stop(), [stop]);

  const mm = Math.floor(elapsedSec / 60);
  const ss = Math.floor(elapsedSec % 60);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-700">🔴 중재 프로그램</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">DAF 훈련기</h1>
          <p className="mt-2 max-w-3xl text-slate-600">자신의 음성을 지연(50–500ms)하여 헤드폰으로 되돌려주는 훈련. 말더듬·속해서 말하기·파킨슨 말속도 조절에 임상 검증됨.</p>
        </div>

        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-base font-bold text-amber-900">필독: 헤드폰 사용 경고</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                <li>반드시 헤드폰 또는 이어폰을 착용하세요</li>
                <li>스피커 출력 시 음성 피드백 루프로 강한 하울링이 발생합니다</li>
                <li>첫 시작 시 볼륨을 낮게 설정하고 점차 올리세요</li>
              </ul>
              {!acknowledged && (
                <label className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-900">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="h-4 w-4" />
                  헤드폰을 착용했으며 경고를 이해했습니다
                </label>
              )}
            </div>
          </div>
        </div>

        {errorMsg && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMsg}</div>}

        <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">지연 설정</h2>
            {isActive && <span className="animate-pulse rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">● 활성</span>}
          </div>

          <div className="mb-6">
            <div className="text-center">
              <div className="text-7xl font-bold text-slate-900 tabular-nums">{delayMs}<span className="ml-2 text-2xl text-slate-500">ms</span></div>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">지연 시간</label>
            <input type="range" min={MIN_DELAY_MS} max={MAX_DELAY_MS} step={10} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} className="w-full accent-rose-600" />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>{MIN_DELAY_MS}ms (아주 짧게)</span>
              <span>{MAX_DELAY_MS}ms (긴 지연)</span>
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-slate-700">프리셋</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_DELAYS.map((d) => (
                <button key={d} onClick={() => setDelayMs(d)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${d === delayMs ? "border-rose-500 bg-rose-100 text-rose-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {d}ms
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">볼륨: {Math.round(volume * 100)}%</label>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-rose-600" />
          </div>

          <div className="flex gap-3">
            {!isActive ? (
              <button onClick={start} disabled={!acknowledged} className="flex-1 rounded-xl bg-rose-600 px-6 py-4 text-lg font-semibold text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed">
                DAF 시작
              </button>
            ) : (
              <button onClick={stop} className="flex-1 rounded-xl bg-slate-700 px-6 py-4 text-lg font-semibold text-white hover:bg-slate-800">정지</button>
            )}
          </div>

          {isActive && (
            <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">경과 시간</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-rose-900">{mm.toString().padStart(2, "0")}:{ss.toString().padStart(2, "0")}</p>
            </div>
          )}
        </div>

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">DAF 임상 적용 + 근거</summary>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-slate-900">말더듬 (Stuttering)</p>
              <p className="mt-1 text-xs">50–200ms 지연이 효과적. 비유창 감소.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">파킨슨병 말속도 조절</p>
              <p className="mt-1 text-xs">100–250ms 지연이 말속도 감소에 효과.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">속해서 말하기 (Cluttering)</p>
              <p className="mt-1 text-xs">150–300ms 지연이 속도 조절·명료성 개선에 도움.</p>
            </div>
            <p className="mt-3 text-xs text-slate-500">근거: Kalinowski & Saltuklaroglu (2003) DAF 지연 권장치, Hanson & Metter (1980) PD 적용 근거, Lincoln 외 (2006) Cluttering 제어 검증.</p>
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">사용 팁</summary>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <ol className="list-decimal space-y-1 pl-5">
              <li>헤드폰을 착용합니다 (필수)</li>
              <li>볼륨을 30%로 낮게 시작합니다</li>
              <li>이해했음을 체크하고 DAF 를 시작합니다</li>
              <li>편안한 수준으로 볼륨 조절</li>
              <li>지연 시간을 대상자 반응에 맞게 조절합니다</li>
              <li>15–20분 단위로 훈련 (과도한 노출 경계)</li>
            </ol>
          </div>
        </details>
      </div>
    </main>
  );
}
