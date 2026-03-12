import React from "react";
import Link from "next/link";

export default function HomePage() {
  const baseCardStyle: React.CSSProperties = {
    borderRadius: 14,
    padding: 24,
    textDecoration: "none",
    color: "inherit",
    display: "block",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  };

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "40px 20px",
        display: "grid",
        gap: 24,
      }}
    >
      <section>
        <h1 style={{ marginBottom: 8 }}>PD Pace Trainer</h1>
        <p style={{ color: "#555", marginTop: 0 }}>
          파킨슨병 환자의 말속도 조절 훈련을 위한 웹앱입니다.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
        }}
      >
        <Link
          href="/visual"
          style={{
            ...baseCardStyle,
            background: "#e9f4ff",
            border: "1px solid #b9d9ff",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#1f5fae" }}>시각 단서 훈련</h2>
          <p style={{ marginBottom: 0 }}>
            시각 페이싱 바만 사용하여 읽기 속도를 조절합니다.
          </p>
        </Link>

        <Link
          href="/audio"
          style={{
            ...baseCardStyle,
            background: "#fff4df",
            border: "1px solid #f0cf8b",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#9a6200" }}>청각 단서 훈련</h2>
          <p style={{ marginBottom: 0 }}>
            구 시작 시 청각 cue를 제공하는 훈련입니다.
          </p>
        </Link>

        <Link
          href="/mixed"
          style={{
            ...baseCardStyle,
            background: "#eaf8ee",
            border: "1px solid #b8dfc2",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#2e7d4a" }}>
            시각 + 청각 훈련
          </h2>
          <p style={{ marginBottom: 0 }}>
            시각 페이싱 바와 청각 cue를 함께 사용합니다.
          </p>
        </Link>
      </section>
    </main>
  );
}