/**
 * 대림대학교 언어치료학과 엠블럼(마크) — 보고서 워터마크용 인라인 SVG 문자열.
 * currentColor 사용 → 감싸는 요소의 color/opacity 로 워터마크 톤 제어.
 */
export const EMBLEM_MARK_SVG = `<svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden="true">
<circle cx="180" cy="180" r="160" fill="none" stroke="currentColor" stroke-width="12" />
<line x1="135" y1="100" x2="135" y2="140" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
<line x1="180" y1="90" x2="180" y2="135" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
<line x1="225" y1="100" x2="225" y2="140" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
<line x1="80" y1="170" x2="280" y2="170" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
<polyline points="85,235 140,195 185,235 230,195 275,235" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" />
<polygon points="278,225 295,222 287,238" fill="currentColor" />
<line x1="135" y1="250" x2="135" y2="290" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
<line x1="180" y1="262" x2="180" y2="305" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
<line x1="225" y1="250" x2="225" y2="290" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
</svg>`;
