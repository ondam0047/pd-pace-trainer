"use client";

import { useEffect, useRef } from "react";

export interface TimelineMarker {
  time: number;
  end?: number;
  color: string; // CSS color
  faded?: boolean;
}

interface Props {
  peaks: number[]; // 버킷별 절대 진폭 (0~1)
  duration: number;
  currentTime: number;
  markers: TimelineMarker[];
  onSeek: (time: number) => void;
  height?: number;
}

export default function WaveformTimeline({
  peaks,
  duration,
  currentTime,
  markers,
  onSeek,
  height = 120,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const cssW = wrap.clientWidth;
      const cssH = height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssW, cssH);

      // 배경
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, cssW, cssH);

      const mid = cssH / 2;

      // 구간 마커 (end 있는 것) — 반투명 영역 먼저
      for (const m of markers) {
        if (m.end == null || duration <= 0) continue;
        const x1 = (m.time / duration) * cssW;
        const x2 = (m.end / duration) * cssW;
        ctx.fillStyle = hexToRgba(m.color, m.faded ? 0.1 : 0.18);
        ctx.fillRect(x1, 0, Math.max(2, x2 - x1), cssH);
      }

      // 파형
      const n = peaks.length;
      if (n > 0) {
        ctx.fillStyle = "#cbd5e1";
        const barW = cssW / n;
        for (let i = 0; i < n; i++) {
          const a = Math.min(1, peaks[i]);
          const h = Math.max(1, a * (cssH * 0.9));
          ctx.fillRect(i * barW, mid - h / 2, Math.max(0.5, barW * 0.8), h);
        }
      }

      // 마커 세로선
      for (const m of markers) {
        if (duration <= 0) continue;
        const x = (m.time / duration) * cssW;
        ctx.strokeStyle = hexToRgba(m.color, m.faded ? 0.4 : 1);
        ctx.lineWidth = m.faded ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssH);
        ctx.stroke();
        // 상단 점
        ctx.fillStyle = hexToRgba(m.color, m.faded ? 0.5 : 1);
        ctx.beginPath();
        ctx.arc(x, 5, m.faded ? 2.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 재생 헤드
      if (duration > 0) {
        const px = (currentTime / duration) * cssW;
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, cssH);
        ctx.stroke();
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [peaks, duration, currentTime, markers, height]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap || duration <= 0) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.max(0, Math.min(duration, (x / rect.width) * duration));
    onSeek(t);
  };

  return (
    <div
      ref={wrapRef}
      onClick={handleClick}
      className="relative w-full cursor-pointer overflow-hidden rounded-lg border border-slate-200"
      style={{ height }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

function hexToRgba(color: string, alpha: number): string {
  // #rrggbb 또는 이미 rgb/이름이면 그대로 (alpha 무시 케이스 최소화 위해 hex만 처리)
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
