"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentSession } from "@/components/currentSessionStorage";
import {
  ChunkMode,
  clearTrainingSettings,
  loadTrainingSettings,
  saveTrainingSettings,
  type TrainingModuleSettings,
} from "./trainingSettingsStorage";
import { saveTrainingRecord } from "./trainingStorage";
import {
  CustomPreset,
  deleteClientPreset,
  loadClientPresets,
  resetClientPresets,
  saveClientPresets,
  upsertClientPreset,
} from "./presetStorage";

const DEFAULT_SETTINGS: TrainingModuleSettings = {
  clientName: "",
  sessionNote: "",
  practiceText: "오늘은 천천히 또박또박 말해 볼게요.",
  selectedPresetId: null,
  targetSps: 3.0,
  chunkMode: "2단어씩",
  pauseSec: 0.5,
  displayFontSize: 15,
};

function countKoreanSyllables(text: string) {
  const matches = text.match(/[가-힣]/g);
  return matches ? matches.length : 0;
}

function getChunkSize(chunkMode: ChunkMode) {
  if (chunkMode === "1단어씩") return 1;
  if (chunkMode === "2단어씩") return 2;
  if (chunkMode === "3단어씩") return 3;
  if (chunkMode === "4단어씩") return 4;
  return Number.MAX_SAFE_INTEGER;
}

function splitIntoChunks(text: string, chunkMode: ChunkMode) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/);
  const chunkSize = getChunkSize(chunkMode);

  if (chunkSize === Number.MAX_SAFE_INTEGER) return [trimmed];

  const result: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    result.push(words.slice(i, i + chunkSize).join(" "));
  }
  return result;
}

function getFeedback(measuredSps: number, targetSps: number) {
  const diff = measuredSps - targetSps;
  if (diff > 0.4) return "빠름";
  if (diff < -0.4) return "느림";
  return "적절";
}

function getFeedbackStyle(feedback: string): React.CSSProperties {
  if (feedback === "빠름") {
    return { background: "#ffe5e5", color: "#c62828", border: "1px solid #f3b1b1" };
  }
  if (feedback === "적절") {
    return { background: "#e7f7ea", color: "#2e7d32", border: "1px solid #b8debd" };
  }
  if (feedback === "느림") {
    return { background: "#e8f1ff", color: "#1565c0", border: "1px solid #b8cff5" };
  }
  return { background: "#f3f3f3", color: "#666", border: "1px solid #ddd" };
}

function getStatusStyle(statusText: string): React.CSSProperties {
  if (statusText === "훈련 진행 중") {
    return { background: "#e9f4ff", color: "#1e88e5", border: "1px solid #b9d9ff" };
  }
  if (statusText === "훈련 완료") {
    return { background: "#e7f7ea", color: "#2e7d32", border: "1px solid #b8debd" };
  }
  if (statusText === "훈련 중지") {
    return { background: "#fff2e2", color: "#ef6c00", border: "1px solid #f2c48d" };
  }
  return { background: "#f3f3f3", color: "#666", border: "1px solid #ddd" };
}

export default function PacingBar() {
  const [clientName, setClientName] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [practiceText, setPracticeText] = useState(DEFAULT_SETTINGS.practiceText);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(DEFAULT_SETTINGS.selectedPresetId);
  const [targetSps, setTargetSps] = useState(DEFAULT_SETTINGS.targetSps);
  const [chunkMode, setChunkMode] = useState<ChunkMode>(DEFAULT_SETTINGS.chunkMode);
  const [pauseSec, setPauseSec] = useState(DEFAULT_SETTINGS.pauseSec);
  const [displayFontSize, setDisplayFontSize] = useState(DEFAULT_SETTINGS.displayFontSize);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);

  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [presetLabelInput, setPresetLabelInput] = useState("");
  const [presetTextInput, setPresetTextInput] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [activeChunkIndex, setActiveChunkIndex] = useState(-1);
  const [ballProgress, setBallProgress] = useState(0);
  const [statusText, setStatusText] = useState("대기 중");

  const [measuredSps, setMeasuredSps] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [recordingSec, setRecordingSec] = useState<number | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  const chunks = useMemo(() => splitIntoChunks(practiceText, chunkMode), [practiceText, chunkMode]);
  const totalSyllables = useMemo(() => countKoreanSyllables(practiceText), [practiceText]);

  const targetTotalSec = useMemo(() => {
    if (targetSps <= 0) return 0;
    return totalSyllables / targetSps;
  }, [totalSyllables, targetSps]);

  function syncForClient(nextName: string, nextNote: string) {
    const normalizedName = (nextName ?? "").trim();
    const saved = loadTrainingSettings("visual", DEFAULT_SETTINGS, normalizedName);
    const nextPresets = loadClientPresets(normalizedName);

    setClientName(normalizedName);
    setSessionNote(nextNote ?? "");
    setPracticeText(saved.practiceText);
    setSelectedPresetId(saved.selectedPresetId);
    setTargetSps(saved.targetSps);
    setChunkMode(saved.chunkMode);
    setPauseSec(saved.pauseSec);
    setDisplayFontSize(saved.displayFontSize);
    setPresets(nextPresets);
    setHasLoadedSettings(true);

    const selectedPreset =
      nextPresets.find((preset) => preset.id === saved.selectedPresetId) ?? null;

    setPresetLabelInput(selectedPreset?.label ?? "");
    setPresetTextInput(selectedPreset?.text ?? "");
  }

  useEffect(() => {
    const current = getCurrentSession();
    syncForClient(current.clientName ?? "", current.sessionNote ?? "");
  }, []);

  useEffect(() => {
    const handleSessionUpdated = () => {
      const current = getCurrentSession();
      syncForClient(current.clientName ?? "", current.sessionNote ?? "");
    };

    window.addEventListener("pd-current-session-updated", handleSessionUpdated);
    return () => {
      window.removeEventListener("pd-current-session-updated", handleSessionUpdated);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSettings) return;

    saveTrainingSettings("visual", {
      clientName,
      sessionNote,
      practiceText,
      selectedPresetId,
      targetSps,
      chunkMode,
      pauseSec,
      displayFontSize,
    });
  }, [
    hasLoadedSettings,
    clientName,
    sessionNote,
    practiceText,
    selectedPresetId,
    targetSps,
    chunkMode,
    pauseSec,
    displayFontSize,
  ]);

  useEffect(() => {
    return () => {
      clearAllTimers();
      stopRecording(false);
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
  }, [recordedAudioUrl]);

  function clearAllTimers() {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  }

  function increaseFontSize() {
    setDisplayFontSize((prev) => Math.min(prev + 1, 30));
  }

  function decreaseFontSize() {
    setDisplayFontSize((prev) => Math.max(prev - 1, 12));
  }

  function resetSettingsToDefault() {
    if (isRunning) return;

    clearTrainingSettings("visual", clientName);
    setPracticeText(DEFAULT_SETTINGS.practiceText);
    setSelectedPresetId(null);
    setTargetSps(DEFAULT_SETTINGS.targetSps);
    setChunkMode(DEFAULT_SETTINGS.chunkMode);
    setPauseSec(DEFAULT_SETTINGS.pauseSec);
    setDisplayFontSize(DEFAULT_SETTINGS.displayFontSize);
  }

  function handleSelectPreset(preset: CustomPreset) {
    if (isRunning) return;
    setSelectedPresetId(preset.id);
    setPracticeText(preset.text);
    setPresetLabelInput(preset.label);
    setPresetTextInput(preset.text);
  }

  function handleNewPreset() {
    setSelectedPresetId(null);
    setPresetLabelInput("");
    setPresetTextInput(practiceText.trim() || "");
  }

  function handleSavePreset() {
    if (!clientName.trim()) {
      alert("홈에서 대상자 이름을 먼저 저장해주세요.");
      return;
    }

    const nextLabel = presetLabelInput.trim();
    const nextText = presetTextInput.trim();

    if (!nextLabel || !nextText) {
      alert("preset 이름과 문구를 입력해주세요.");
      return;
    }

    const nextPreset: CustomPreset = {
      id: selectedPresetId ?? crypto.randomUUID(),
      label: nextLabel,
      text: nextText,
    };

    const nextPresets = upsertClientPreset(clientName, nextPreset);
    setPresets(nextPresets);
    setSelectedPresetId(nextPreset.id);
    setPracticeText(nextPreset.text);
    setPresetLabelInput(nextPreset.label);
    setPresetTextInput(nextPreset.text);
  }

  function handleDeletePreset() {
    if (!clientName.trim()) {
      alert("홈에서 대상자 이름을 먼저 저장해주세요.");
      return;
    }
    if (!selectedPresetId) {
      alert("삭제할 preset을 먼저 선택해주세요.");
      return;
    }

    const ok = window.confirm("선택한 preset을 삭제할까요?");
    if (!ok) return;

    const nextPresets = deleteClientPreset(clientName, selectedPresetId);
    setPresets(nextPresets);
    setSelectedPresetId(null);
    setPresetLabelInput("");
    setPresetTextInput("");
  }

  function handleResetPresets() {
    if (!clientName.trim()) {
      alert("홈에서 대상자 이름을 먼저 저장해주세요.");
      return;
    }

    const ok = window.confirm("현재 대상자의 preset을 기본값으로 되돌릴까요?");
    if (!ok) return;

    resetClientPresets(clientName);
    const nextPresets = loadClientPresets(clientName);
    setPresets(nextPresets);
    setSelectedPresetId(null);
    setPresetLabelInput("");
    setPresetTextInput("");
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("이 브라우저에서는 녹음을 지원하지 않습니다.");
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartRef.current = performance.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);

        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);

        if (recordingStartRef.current !== null) {
          const sec = (performance.now() - recordingStartRef.current) / 1000;
          setRecordingSec(Number(sec.toFixed(2)));

          if (totalSyllables > 0 && sec > 0) {
            const actualSps = totalSyllables / sec;
            const resultFeedback = getFeedback(actualSps, targetSps);

            setMeasuredSps(Number(actualSps.toFixed(2)));
            setFeedback(resultFeedback);

            saveTrainingRecord({
              id: crypto.randomUUID(),
              savedAt: new Date().toISOString(),
              moduleType: "visual",
              clientName: clientName.trim(),
              sessionNote: sessionNote.trim(),
              practiceText: practiceText.trim(),
              targetSps,
              measuredSps: Number(actualSps.toFixed(2)),
              feedback: resultFeedback,
              chunkMode,
              recordingSec: Number(sec.toFixed(2)),
            });
          }
        }

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start();
      return true;
    } catch (error) {
      console.error(error);
      alert("마이크 권한을 허용해야 녹음할 수 있습니다.");
      return false;
    }
  }

  function stopRecording(shouldStopRecorder = true) {
    if (shouldStopRecorder && mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function startTraining() {
    if (!practiceText.trim()) {
      alert("연습 문구를 입력해주세요.");
      return;
    }
    if (totalSyllables === 0) {
      alert("한글 문구를 포함해주세요.");
      return;
    }
    if (chunks.length === 0) {
      alert("문구를 확인해주세요.");
      return;
    }

    clearAllTimers();
    setMeasuredSps(null);
    setFeedback("");
    setRecordingSec(null);
    setBallProgress(0);
    setActiveChunkIndex(-1);
    setStatusText("녹음 시작 준비 중");

    const ok = await startRecording();
    if (!ok) return;

    setIsRunning(true);
    setStatusText("훈련 진행 중");

    const chunkDurations = chunks.map((chunk) => {
      const syllables = Math.max(countKoreanSyllables(chunk), 1);
      return (syllables / targetSps) * 1000;
    });

    const totalTimelineMs =
      chunkDurations.reduce((sum, ms) => sum + ms, 0) +
      Math.max(chunks.length - 1, 0) * pauseSec * 1000;

    let accumulatedMs = 0;

    chunks.forEach((_, index) => {
      const chunkMs = chunkDurations[index];
      const startMs = accumulatedMs;
      const endMs = startMs + chunkMs;

      const startTimeout = window.setTimeout(() => {
        setActiveChunkIndex(index);
      }, startMs);

      const progressTimeout = window.setTimeout(() => {
        const progress = totalTimelineMs > 0 ? (endMs / totalTimelineMs) * 100 : 0;
        setBallProgress(Math.min(progress, 100));
      }, endMs);

      timeoutsRef.current.push(startTimeout, progressTimeout);

      accumulatedMs = endMs;
      if (index < chunks.length - 1) accumulatedMs += pauseSec * 1000;
    });

    const finishTimeout = window.setTimeout(() => {
      finishTraining();
    }, totalTimelineMs);

    timeoutsRef.current.push(finishTimeout);
  }

  function finishTraining() {
    clearAllTimers();
    setIsRunning(false);
    setActiveChunkIndex(-1);
    setBallProgress(100);
    setStatusText("훈련 완료");
    stopRecording(true);
  }

  function stopTrainingManually() {
    clearAllTimers();
    setIsRunning(false);
    setActiveChunkIndex(-1);
    setStatusText("훈련 중지");
    stopRecording(true);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 24, color: "#1f5fae" }}>시각 단서 훈련</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d0d7de", background: "#fff", color: "#333", textDecoration: "none", fontWeight: 600 }}>
              홈으로
            </Link>
            <Link href="/results" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #b9d9ff", background: "#f4f9ff", color: "#1f5fae", textDecoration: "none", fontWeight: 600 }}>
              결과 보기
            </Link>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <strong>사용자 이름 / ID</strong>
              <input type="text" value={clientName} readOnly style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", background: "#f8fafc" }} />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <strong>세션 메모</strong>
              <input type="text" value={sessionNote} readOnly style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", background: "#f8fafc" }} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <strong>현재 대상자 preset</strong>
              <button
                type="button"
                onClick={resetSettingsToDefault}
                disabled={isRunning}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cfdceb", background: "#f7f9fc", cursor: isRunning ? "not-allowed" : "pointer" }}
              >
                이 사용자의 설정 초기화
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  disabled={isRunning}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: selectedPresetId === preset.id ? "1px solid #5aa9ff" : "1px solid #cfdceb",
                    background: selectedPresetId === preset.id ? "#dff4ff" : "#f4f9ff",
                    color: "#1f5fae",
                    cursor: isRunning ? "not-allowed" : "pointer",
                    fontWeight: selectedPresetId === preset.id ? 700 : 500,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fafafa", marginBottom: 16 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 8 }}>
                <strong>preset 이름</strong>
                <input
                  type="text"
                  value={presetLabelInput}
                  onChange={(e) => setPresetLabelInput(e.target.value)}
                  placeholder="예: 병원 예약 문구"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <strong>preset 문구</strong>
                <textarea
                  value={presetTextInput}
                  onChange={(e) => setPresetTextInput(e.target.value)}
                  rows={3}
                  placeholder="환자별로 자주 쓰는 문구를 저장하세요"
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={handleNewPreset} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
                  새 preset
                </button>
                <button type="button" onClick={handleSavePreset} style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  preset 저장
                </button>
                <button type="button" onClick={handleDeletePreset} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", cursor: "pointer" }}>
                  선택 preset 삭제
                </button>
                <button type="button" onClick={handleResetPresets} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}>
                  preset 기본값 복원
                </button>
              </div>
            </div>
          </div>

          <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <strong>연습 문구</strong>
            <textarea
              value={practiceText}
              onChange={(e) => {
                setPracticeText(e.target.value);
                setSelectedPresetId(null);
              }}
              rows={5}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", resize: "vertical" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <strong>목표 SPS</strong>
              <input type="number" min={1} max={8} step={0.1} value={targetSps} onChange={(e) => setTargetSps(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <strong>읽기 단위</strong>
              <select value={chunkMode} onChange={(e) => setChunkMode(e.target.value as ChunkMode)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}>
                <option>1단어씩</option>
                <option>2단어씩</option>
                <option>3단어씩</option>
                <option>4단어씩</option>
                <option>전체 문장 읽기</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <strong>구 끝 pause(초)</strong>
              <input type="number" min={0} max={3} step={0.1} value={pauseSec} onChange={(e) => setPauseSec(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
            </label>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, background: "#fff" }}>
          <h3 style={{ marginTop: 0 }}>요약</h3>
          <div style={{ display: "grid", gap: 12, fontSize: 15 }}>
            <div><strong>총 한글 음절 수:</strong> {totalSyllables}</div>
            <div><strong>목표 전체 시간:</strong> {targetTotalSec.toFixed(2)}초</div>
            <div><strong>어절 개수:</strong> {chunks.length}</div>
            <div>
              <strong>상태:</strong>{" "}
              <span style={{ ...getStatusStyle(statusText), display: "inline-block", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>
                {statusText}
              </span>
            </div>
            <div>
              <strong>실제 SPS:</strong>{" "}
              <span style={{ fontWeight: 700, color: feedback === "빠름" ? "#c62828" : feedback === "적절" ? "#2e7d32" : feedback === "느림" ? "#1565c0" : "#222" }}>
                {measuredSps !== null ? measuredSps : "-"}
              </span>
            </div>
            <div>
              <strong>피드백:</strong>{" "}
              <span style={{ ...getFeedbackStyle(feedback), display: "inline-block", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>
                {feedback || "-"}
              </span>
            </div>
            <div><strong>녹음 시간:</strong> {recordingSec !== null ? `${recordingSec}초` : "-"}</div>
          </div>
        </section>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>문장 어절 표시</h3>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#666" }}>글자 크기: {displayFontSize}</span>
            <button onClick={decreaseFontSize} type="button" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #b9d9ff", background: "#f4f9ff", cursor: "pointer", fontWeight: 700 }}>
              A-
            </button>
            <button onClick={increaseFontSize} type="button" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #b9d9ff", background: "#f4f9ff", cursor: "pointer", fontWeight: 700 }}>
              A+
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {chunks.map((chunk, index) => (
            <span
              key={`${chunk}-${index}`}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: index === activeChunkIndex ? "#dff4ff" : "transparent",
                fontWeight: index === activeChunkIndex ? 700 : 500,
                fontSize: displayFontSize,
              }}
            >
              {chunk}
            </span>
          ))}
        </div>

        <div style={{ position: "relative", height: 52, borderRadius: 999, background: "#eef4fb", border: "1px solid #cfdceb", marginBottom: 18, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: `calc(${ballProgress}% - 18px)`,
              top: "50%",
              transform: "translateY(-50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#4aa3ff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
              transition: isRunning ? "left 0.3s linear" : "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={isRunning ? stopTrainingManually : startTraining}
            style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: isRunning ? "#ffe3e3" : "#dff7df", color: isRunning ? "#b71c1c" : "#1b5e20", cursor: "pointer", fontWeight: 700 }}
          >
            {isRunning ? "정지" : "시작"}
          </button>
        </div>

        {recordedAudioUrl && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#f4f9ff", border: "1px solid #d6e8ff" }}>
            <strong style={{ color: "#1f5fae" }}>녹음 다시 듣기</strong>
            <div style={{ marginTop: 8 }}>
              <audio controls src={recordedAudioUrl} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}