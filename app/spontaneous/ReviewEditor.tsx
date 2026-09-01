"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Speaker = "아동" | "치료사" | "제외";

export type Row = {
  id: number;
  start: number;
  end: number;
  speaker: Speaker;
  text: string;
  produced?: string;
};

const SPEAKERS: Speaker[] = ["아동", "치료사", "제외"];

const SPEAKER_STYLE: Record<Speaker, string> = {
  아동: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  치료사: "bg-sky-100 text-sky-800 ring-sky-200",
  제외: "bg-slate-100 text-slate-500 ring-slate-200",
};

function ts(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, "0")}:${r.toFixed(1).padStart(4, "0")}`;
}

type Props = {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  audioUrl: string | null;
  /** 조음 모드면 산출형 칸을 함께 보여준다. */
  showProduced?: boolean;
};

/**
 * 전사 검수 편집기.
 *
 * 스프레드시트가 아니라 자막 편집기 방식이다 — 커서가 있는 행 하나를 다루고,
 * 화자 지정은 숫자키 한 번으로 끝나며 곧바로 다음 행으로 넘어간다.
 * 행을 옮기면 그 구간만 자동 재생되므로 오디오 바를 손으로 긁을 일이 없다.
 */
export default function ReviewEditor({ rows, onChange, audioUrl, showProduced }: Props) {
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState<null | "text" | "produced">(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(rows.length - 1, i)),
    [rows.length],
  );

  // ── 구간 재생 ──────────────────────────────────────────────────────────
  const playRow = useCallback((i: number) => {
    const a = audioRef.current;
    const r = rows[i];
    if (!a || !r) return;
    stopAtRef.current = r.end > r.start ? r.end : null;
    try {
      a.currentTime = r.start;
      void a.play();
    } catch {
      /* 사용자 제스처 전이면 브라우저가 막는다 — 무시 */
    }
  }, [rows]);

  const stop = useCallback(() => {
    stopAtRef.current = null;
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const at = stopAtRef.current;
      if (at !== null && a.currentTime >= at) {
        stopAtRef.current = null;
        a.pause();
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  // 커서 이동 → 스크롤 + 자동 재생
  const moveTo = useCallback((i: number) => {
    const n = clamp(i);
    setCursor(n);
    rowRefs.current[n]?.scrollIntoView({ block: "nearest" });
    if (autoPlay) playRow(n);
  }, [clamp, autoPlay, playRow]);

  const setRow = useCallback((i: number, patch: Partial<Row>) => {
    onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }, [rows, onChange]);

  const assign = useCallback((i: number, sp: Speaker) => {
    onChange(rows.map((r, k) => (k === i ? { ...r, speaker: sp } : r)));
    // 지정하면 곧바로 다음 행 — 이게 "하나하나 클릭"을 없애는 핵심
    if (i < rows.length - 1) moveTo(i + 1);
  }, [rows, onChange, moveTo]);

  const mergeUp = useCallback((i: number) => {
    if (i <= 0) return;
    const next = rows.slice();
    const prev = next[i - 1];
    const cur = next[i];
    next[i - 1] = {
      ...prev,
      text: `${prev.text} ${cur.text}`.trim(),
      produced: [prev.produced, cur.produced].filter(Boolean).join(" ").trim() || undefined,
      end: Math.max(prev.end, cur.end),
    };
    next.splice(i, 1);
    onChange(next);
    setCursor(clamp(i - 1));
  }, [rows, onChange, clamp]);

  const removeRow = useCallback((i: number) => {
    if (rows.length <= 1) return;
    const next = rows.slice();
    next.splice(i, 1);
    onChange(next);
    setCursor(clamp(i));
  }, [rows, onChange, clamp]);

  // ── 키보드 ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");

      if (typing) {
        if (e.key === "Escape") {
          e.preventDefault();
          setEditing(null);
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          setEditing(null);
          moveTo(cursor + 1);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown": case "j":
          e.preventDefault(); moveTo(cursor + 1); break;
        case "ArrowUp": case "k":
          e.preventDefault(); moveTo(cursor - 1); break;
        case "1": case "2": case "3":
          e.preventDefault(); assign(cursor, SPEAKERS[Number(e.key) - 1]); break;
        case " ":
          e.preventDefault();
          if (playing) stop(); else playRow(cursor);
          break;
        case "Enter":
          e.preventDefault(); setEditing("text"); break;
        case "p": case "P":
          if (showProduced) { e.preventDefault(); setEditing("produced"); }
          break;
        case "m": case "M":
          e.preventDefault(); mergeUp(cursor); break;
        case "Backspace": case "Delete":
          e.preventDefault(); removeRow(cursor); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, playing, showProduced, moveTo, assign, playRow, stop, mergeUp, removeRow]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const counts = SPEAKERS.map((s) => rows.filter((r) => r.speaker === s).length);

  return (
    <div className="flex flex-col gap-3">
      {audioUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={audioUrl} controls className="w-full" preload="auto" />
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => setAutoPlay(e.target.checked)}
          />
          행 이동 시 자동 재생
        </label>
        <span className="text-slate-300">|</span>
        <span className="text-slate-600">
          아동 <b className="text-emerald-700">{counts[0]}</b> · 치료사{" "}
          <b className="text-sky-700">{counts[1]}</b> · 제외{" "}
          <b className="text-slate-500">{counts[2]}</b> · 전체 {rows.length}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          <kbd className="kbd">↑↓</kbd>/<kbd className="kbd">j k</kbd> 이동 ·{" "}
          <kbd className="kbd">1</kbd>아동 <kbd className="kbd">2</kbd>치료사{" "}
          <kbd className="kbd">3</kbd>제외 · <kbd className="kbd">Space</kbd> 재생 ·{" "}
          <kbd className="kbd">Enter</kbd> 수정{showProduced ? <> · <kbd className="kbd">P</kbd> 산출형</> : null} ·{" "}
          <kbd className="kbd">M</kbd> 위와 합치기 · <kbd className="kbd">Del</kbd> 삭제
        </span>
      </div>

      <div
        ref={listRef}
        className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white"
      >
        {rows.map((r, i) => {
          const active = i === cursor;
          return (
            <div
              key={r.id}
              ref={(el) => { rowRefs.current[i] = el; }}
              onClick={() => moveTo(i)}
              className={
                "flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 " +
                (active ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300" : "hover:bg-slate-50")
              }
            >
              <span className="w-10 shrink-0 pt-0.5 text-right text-xs tabular-nums text-slate-400">
                {i + 1}
              </span>
              <span className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-slate-500">
                {ts(r.start)}
              </span>

              <select
                value={r.speaker}
                onChange={(e) => setRow(i, { speaker: e.target.value as Speaker })}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${i + 1}번 발화 화자`}
                className={
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 " +
                  SPEAKER_STYLE[r.speaker]
                }
              >
                {SPEAKERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <div className="min-w-0 flex-1">
                {active && editing === "text" ? (
                  <textarea
                    ref={inputRef}
                    value={r.text}
                    onChange={(e) => setRow(i, { text: e.target.value })}
                    onBlur={() => setEditing(null)}
                    rows={2}
                    className="w-full rounded-md border border-indigo-300 px-2 py-1 text-sm"
                  />
                ) : (
                  <p
                    className={r.speaker === "제외" ? "text-slate-400 line-through" : "text-slate-800"}
                    onDoubleClick={() => { moveTo(i); setEditing("text"); }}
                  >
                    {r.text || <span className="text-slate-300">(빈 발화)</span>}
                  </p>
                )}

                {showProduced && (
                  active && editing === "produced" ? (
                    <textarea
                      ref={inputRef}
                      value={r.produced ?? ""}
                      onChange={(e) => setRow(i, { produced: e.target.value })}
                      onBlur={() => setEditing(null)}
                      rows={2}
                      placeholder="산출형 (실제 들린 대로)"
                      className="mt-1 w-full rounded-md border border-rose-300 px-2 py-1 text-sm"
                    />
                  ) : (
                    <p
                      className="mt-0.5 text-xs text-rose-700"
                      onDoubleClick={() => { moveTo(i); setEditing("produced"); }}
                    >
                      산출형: {r.produced || <span className="text-slate-300">(비어 있음)</span>}
                    </p>
                  )
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-slate-400">발화가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
