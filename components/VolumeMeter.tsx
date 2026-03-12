"use client";

import { useEffect, useRef, useState } from "react";

export default function VolumeMeter() {
  const [status, setStatus] = useState("대기 중");
  const [volume, setVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const startMeter = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / dataArray.length);
        const scaled = Math.min(100, Math.round(rms * 300));
        setVolume(scaled);

        animationRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setStatus("마이크 연결 성공");
    } catch (error) {
      console.error(error);
      setStatus("마이크 연결 실패");
    }
  };

  const stopMeter = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setVolume(0);
    setStatus("마이크 중지");
  };

  useEffect(() => {
    return () => {
      stopMeter();
    };
  }, []);

  return (
    <div
      style={{
        marginTop: "24px",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        maxWidth: "600px",
      }}
    >
      <h2 style={{ marginBottom: "12px" }}>실시간 음량 바</h2>

      <p style={{ marginBottom: "16px" }}>
        현재 상태: <strong>{status}</strong>
      </p>

      <div
        style={{
          width: "100%",
          height: "24px",
          background: "#eee",
          borderRadius: "999px",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            width: `${volume}%`,
            height: "100%",
            background: volume > 70 ? "#ef4444" : volume > 35 ? "#22c55e" : "#3b82f6",
            transition: "width 0.05s linear",
          }}
        />
      </div>

      <p style={{ marginBottom: "16px" }}>현재 음량: {volume}</p>

      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
  <button
    onClick={startMeter}
    style={{
      padding: "12px 18px",
      borderRadius: "10px",
      border: "none",
      background: "#2563eb",
      color: "white",
      fontWeight: 700,
      fontSize: "15px",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    }}
  >
    음량 측정 시작
  </button>

  <button
    onClick={stopMeter}
    style={{
      padding: "12px 18px",
      borderRadius: "10px",
      border: "1px solid #ccc",
      background: "white",
      color: "#111",
      fontWeight: 700,
      fontSize: "15px",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    }}
  >
    중지
  </button>
</div>
    </div>
  );
}