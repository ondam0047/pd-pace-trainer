"use client";

import { useState } from "react";

export default function MicController() {
  const [status, setStatus] = useState("대기 중");
  const [isConnected, setIsConnected] = useState(false);
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null);

  const handleStartMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStreamRef(stream);
      setStatus("마이크 연결 성공");
      setIsConnected(true);
    } catch (error) {
      console.error(error);
      setStatus("마이크 연결 실패");
      setIsConnected(false);
    }
  };

  const handleStopMic = () => {
    if (streamRef) {
      streamRef.getTracks().forEach((track) => track.stop());
    }
    setStreamRef(null);
    setStatus("마이크 중지");
    setIsConnected(false);
  };

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
      <h2 style={{ marginBottom: "12px" }}>마이크 테스트</h2>

      <p style={{ marginBottom: "16px" }}>
        현재 상태:{" "}
        <span style={{ fontWeight: 700, color: isConnected ? "#16a34a" : "#111" }}>
          {status}
        </span>
      </p>

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={handleStartMic}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          마이크 시작
        </button>

        <button
          onClick={handleStopMic}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #ccc",
            background: "white",
            color: "#111",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          마이크 중지
        </button>
      </div>
    </div>
  );
}