"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReviewEditor, { type Row, type Speaker } from "./ReviewEditor";

type Session = { token: string; apiUrl: string };
type Mode = "language" | "articulation";
type Stage = "gate" | "upload" | "review" | "result";

type Segment = { start: number; end: number; text: string; speaker: Speaker };

type LanguageStats = {
  utterance_count: number; mlu_w: number; mlu_m: number;
  ttr: number; ndw: number; tnw: number;
  semantic_counts?: Record<string, number>;
  gram_categories?: Record<string, number>;
};

export default function SpontaneousClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<Stage>("gate");
  const [mode, setMode] = useState<Mode>("language");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioFileRef = useRef<File | null>(null);

  const [language, setLanguage] = useState<{ stats: LanguageStats } | null>(null);
  const [articulation, setArticulation] = useState<Record<string, unknown> | null>(null);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!session) throw new Error("인증이 필요합니다.");
      const res = await fetch(`${session.apiUrl}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${session.token}`,
        },
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const j = (await res.json()) as { detail?: string; error?: string };
          detail = j.detail ?? j.error ?? detail;
        } catch { /* 본문이 JSON이 아닐 수 있다 */ }
        throw new Error(detail);
      }
      return res.json();
    },
    [session],
  );

  // ── 1) 접근 ───────────────────────────────────────────────────────────
  const [password, setPassword] = useState("");
  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("확인 중…");
    try {
      const res = await fetch("/api/spontaneous/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = (await res.json()) as { token?: string; apiUrl?: string; error?: string };
      if (!res.ok || !j.token || !j.apiUrl) throw new Error(j.error ?? "토큰 발급 실패");
      setSession({ token: j.token, apiUrl: j.apiUrl.replace(/\/$/, "") });
      setStage("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // ── 2) 업로드 + 전사 ──────────────────────────────────────────────────
  const onFile = async (file: File) => {
    setError(null);
    setNotice(null);
    audioFileRef.current = file;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    setBusy("전사 중… (파일 길이에 따라 수십 초 걸릴 수 있어요)");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("language", "ko");
      const j = (await api("/transcribe", { method: "POST", body: fd })) as {
        segments: Segment[]; diarized: boolean; fallbackReason?: string;
      };
      setRows(j.segments.map((s, i) => ({
        id: i, start: s.start, end: s.end, speaker: s.speaker, text: s.text,
      })));
      setNotice(
        j.diarized
          ? "화자를 자동으로 나눴습니다. 틀린 것만 숫자키로 고치세요."
          : `화자 자동 분리를 쓰지 못했습니다(${j.fallbackReason ?? "사유 불명"}). 화자는 직접 지정해 주세요.`,
      );
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  /**
   * 샘플 전사 — API 호출 없이 검수 조작을 익히기 위한 것.
   * 수업에서 학생이 단축키를 연습하는 데 쓴다(전사 크레딧 소모 없음).
   */
  const loadSample = () => {
    setError(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    audioFileRef.current = null;
    const sample: [number, number, Speaker, string][] = [
      [0.0, 2.1, "치료사", "오늘 유치원에서 뭐 했어?"],
      [2.3, 5.0, "아동", "친구랑 블록 가지고 놀았어요"],
      [5.2, 6.4, "치료사", "무슨 블록?"],
      [6.6, 9.8, "아동", "큰 거 빨간 거로 성 만들었어"],
      [10.0, 11.2, "치료사", "우와 멋있었겠다"],
      [11.4, 14.6, "아동", "근데 동생이 자꾸 부수니까 속상했어요"],
      [14.8, 16.0, "치료사", "그래서 어떻게 했어?"],
      [16.2, 19.1, "아동", "선생님한테 말했어 그래서 다시 만들었어요"],
    ];
    setRows(sample.map(([start, end, speaker, text], id) => ({ id, start, end, speaker, text })));
    setNotice(
      "샘플 전사입니다(오디오 없음). 단축키로 화자 지정·수정을 연습해 보세요. " +
      "실제 분석은 음성 파일을 올리면 됩니다.",
    );
    setStage("review");
  };

  // ── 3) 조음: 산출형 미리 채우기 ────────────────────────────────────────
  const fillProduced = async () => {
    setError(null);
    setBusy("표준 발음형 계산 중…");
    try {
      const targets = rows.map((r) => r.text);
      const j = (await api("/g2p", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      })) as { pronunciations: string[] };
      setRows(rows.map((r, i) => (r.produced ? r : { ...r, produced: j.pronunciations[i] ?? "" })));
      setNotice("산출형을 목표 발음형으로 채웠습니다. 아동이 다르게 낸 음소만 고치세요 (P 키).");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // ── 4) 분석 ───────────────────────────────────────────────────────────
  const childRows = useMemo(() => rows.filter((r) => r.speaker === "아동" && r.text.trim()), [rows]);

  const analyze = async () => {
    setError(null);
    setBusy("분석 중…");
    try {
      if (mode === "language") {
        const j = (await api("/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ utterances: childRows.map((r) => r.text) }),
        })) as { result: { stats: LanguageStats } };
        setLanguage(j.result);
        setArticulation(null);
      } else {
        const pairs = childRows
          .filter((r) => (r.produced ?? "").trim())
          .map((r) => [r.text, r.produced ?? ""]);
        if (!pairs.length) throw new Error("산출형이 채워진 아동 발화가 없습니다.");
        const j = (await api("/articulation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pairs }),
        })) as { result: Record<string, unknown> };
        setArticulation(j.result);
        setLanguage(null);
      }
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const downloadReport = async () => {
    setBusy("보고서 생성 중…");
    try {
      const j = (await api("/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, articulation, title: "자발화 분석 보고서" }),
      })) as { html: string };
      const blob = new Blob([j.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `자발화분석_${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // ── 렌더 ──────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">← Voice Lab 허브로</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">자발화 언어/조음 분석</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            음성을 올리면 발화별로 나눠 전사하고 화자를 자동으로 구분합니다. 검수는
            키보드로 합니다 — 행을 옮기면 그 구간만 재생되고, 숫자키 한 번으로 화자를
            지정하면 바로 다음 발화로 넘어갑니다.
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {notice}
          </p>
        )}
        {busy && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {busy}
          </p>
        )}

        {stage === "gate" && (
          <form onSubmit={unlock} className="max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <label htmlFor="sp-pw" className="block text-sm font-semibold text-slate-700">
              접근 비밀번호
            </label>
            <input
              id="sp-pw" type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit" disabled={!!busy}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              시작하기
            </button>
            <p className="text-xs text-slate-500">
              분석에 외부 AI 서비스를 사용하므로 접근을 제한합니다. 수업·연구용 비밀번호는 담당 교수에게 문의하세요.
            </p>
          </form>
        )}

        {stage !== "gate" && (
          <div className="flex flex-wrap items-center gap-2">
            {(["language", "articulation"] as Mode[]).map((m) => (
              <button
                key={m} type="button" onClick={() => setMode(m)}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 " +
                  (mode === m
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100")
                }
              >
                {m === "language" ? "📝 언어 분석" : "🔊 조음 분석"}
              </button>
            ))}
            <span className="text-xs text-slate-500">
              {mode === "language"
                ? "MLU-w · MLU-m · TTR · NDW · TNW"
                : "PCC · PVC · 컨퓨전 매트릭스 · 음운변동"}
            </span>
          </div>
        )}

        {(stage === "upload" || stage === "review" || stage === "result") && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <label htmlFor="sp-file" className="block text-sm font-semibold text-slate-700">
              음성 파일 (wav · mp3 · m4a · webm)
            </label>
            <input
              id="sp-file" type="file" accept="audio/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
              disabled={!!busy}
              className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <p className="mt-2 text-xs text-slate-500">
              업로드한 음성은 전사를 위해 외부 AI 서비스(미국)로 전송됩니다. 보호자 동의·기관 정책을 확인하세요.
            </p>
            <button
              type="button" onClick={loadSample} disabled={!!busy}
              className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              단축키 연습용 샘플 전사 불러오기 (음성 없이)
            </button>
          </div>
        )}

        {(stage === "review" || stage === "result") && rows.length > 0 && (
          <>
            <ReviewEditor
              rows={rows}
              onChange={setRows}
              audioUrl={audioUrl}
              showProduced={mode === "articulation"}
            />

            <div className="flex flex-wrap gap-2">
              {mode === "articulation" && (
                <button
                  type="button" onClick={fillProduced} disabled={!!busy}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  📝 산출형 = 목표 발음형으로 채우기
                </button>
              )}
              <button
                type="button" onClick={analyze} disabled={!!busy || childRows.length === 0}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                분석하기 (아동 발화 {childRows.length}개)
              </button>
            </div>
          </>
        )}

        {stage === "result" && language && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-900">언어 분석 결과</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {([
                ["발화 수", language.stats.utterance_count],
                ["MLU-w", language.stats.mlu_w],
                ["MLU-m", language.stats.mlu_m],
                ["TTR", language.stats.ttr],
                ["NDW", language.stats.ndw],
                ["TNW", language.stats.tnw],
              ] as [string, number][]).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="text-xl font-bold tabular-nums text-slate-900">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              kiwipiepy 자동 분석은 임상 정답지보다 과다 집계될 수 있어 검수가 필요합니다.
              본 수치는 학습·연구 보조용이며 진단 지표가 아닙니다.
            </p>
            <button
              type="button" onClick={downloadReport} disabled={!!busy}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              보고서 내려받기 (HTML)
            </button>
          </section>
        )}

        {stage === "result" && articulation && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-900">조음 분석 결과</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">PCC (자음정확도)</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {String(articulation.pcc)}%
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">PVC (모음정확도)</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {String(articulation.pvc)}%
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              참고 범위와의 대조는 해석 보조용이며 정상·비정상 판정이 아닙니다.
            </p>
            <button
              type="button" onClick={downloadReport} disabled={!!busy}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              보고서 내려받기 (HTML)
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
