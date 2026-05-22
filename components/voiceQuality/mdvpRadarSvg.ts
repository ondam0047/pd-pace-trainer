import { MDVP_THRESHOLDS, type VoiceQualityResult } from "./analyzer";

/**
 * MDVP 방사형 다이어그램을 독립 SVG 문자열로 생성 — 보고서(HTML) 임베드용.
 * 화면 컴포넌트(MdvpRadar)와 동일한 기하/규칙을 공유.
 */
const PARAMS: { key: keyof typeof MDVP_THRESHOLDS; code: string }[] = [
  { key: "jitaUs", code: "Jita" },
  { key: "jitterLocal", code: "Jitt" },
  { key: "rap", code: "RAP" },
  { key: "ppq5", code: "PPQ" },
  { key: "vF0", code: "vF0" },
  { key: "nhr", code: "NHR" },
  { key: "vAm", code: "vAm" },
  { key: "apq11", code: "APQ" },
  { key: "shdB", code: "ShdB" },
  { key: "shimmerLocal", code: "Shim" },
];

const W = 460;
const H = 380;
const CX = W / 2;
const CY = H / 2;
const RING = 65; // 비율 1.0 (정상 임계)
const MAX_RATIO = 2;

function pt(ratio: number, angleDeg: number): [number, number] {
  const rr = Math.min(ratio, MAX_RATIO) * RING;
  const a = (angleDeg * Math.PI) / 180;
  return [CX + rr * Math.cos(a), CY + rr * Math.sin(a)];
}

export function mdvpRadarSvg(result: VoiceQualityResult): string {
  const items = PARAMS.map((p, i) => {
    const angle = -90 + (i * 360) / PARAMS.length;
    const value = result[p.key] as number;
    const thr = MDVP_THRESHOLDS[p.key];
    const ratio = thr > 0 ? value / thr : 0;
    return { ...p, angle, value, thr, ratio };
  });

  const grid = [0.5, 1, 1.5, 2]
    .map(
      (r) =>
        `<circle cx="${CX}" cy="${CY}" r="${r * RING}" fill="none" stroke="#e2e8f0"${r === 1 ? "" : ' stroke-dasharray="3 3"'} />`,
    )
    .join("");

  const spokes = items
    .map((it) => {
      const [ex, ey] = pt(MAX_RATIO, it.angle);
      const [lx, ly] = pt(MAX_RATIO + 0.32, it.angle);
      return `<line x1="${CX}" y1="${CY}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#e2e8f0" /><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" fill="#475569">${it.code}</text>`;
    })
    .join("");

  const polygon = items.map((it) => pt(it.ratio, it.angle).map((n) => n.toFixed(1)).join(",")).join(" ");

  const dots = items
    .map((it) => {
      const [x, y] = pt(it.ratio, it.angle);
      const color = it.ratio > 1 ? "#e11d48" : "#16a34a";
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1" />`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" aria-label="MDVP 방사형 다이어그램">
${grid}
<circle cx="${CX}" cy="${CY}" r="${RING}" fill="#dcfce7" fill-opacity="0.5" />
<circle cx="${CX}" cy="${CY}" r="${RING}" fill="none" stroke="#16a34a" stroke-width="1.5" />
${spokes}
<polygon points="${polygon}" fill="#3b82f6" fill-opacity="0.15" stroke="#2563eb" stroke-width="1.5" />
${dots}
<text x="${CX}" y="${CY - RING - 4}" text-anchor="middle" font-size="9" fill="#16a34a" font-weight="700">정상 임계</text>
</svg>`;
}
