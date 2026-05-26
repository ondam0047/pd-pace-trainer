/**
 * voicelab 평가 모듈 — 내보내기 (CSV / HTML 보고서)
 *
 * - CSV: 분석/엑셀용 long-format (한 행 = 한 세션 한 모듈).
 * - 보고서: 사전·중간·사후 한 장 요약 HTML. 브라우저 인쇄(window.print) → PDF.
 *   기존 허브 컨벤션(VHI 보고서)과 동일한 패턴.
 */

import type { EvalSession, Timepoint } from "./evalStorage";

const TP_LABEL: Record<Timepoint, string> = { pre: "사전", mid: "중간", post: "사후" };

interface MetricMeta {
  key: string;
  label: string;
  max: number;
  lowerBetter?: boolean;
}

const METRICS: MetricMeta[] = [
  { key: "cog_reg", label: "지남력·즉시기억", max: 13 },
  { key: "naming", label: "이름대기", max: 15 },
  { key: "cog_recall", label: "지연회상·재인", max: 6 },
  { key: "fluency", label: "유창성(동물)", max: 30 },
  { key: "digit", label: "숫자외우기", max: 13 },
  { key: "discourse", label: "담화", max: 10 },
  { key: "gds", label: "우울(SGDS-K)", max: 15, lowerBetter: true },
  { key: "qol", label: "삶의질(WHOQOL-BREF)", max: 100 },
];

function csvEscape(v: unknown): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tsForFilename(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/**
 * 세션 배열을 long-format CSV 로 내보낸다.
 * 한 행 = (세션 × 모듈) 1건.
 */
export function downloadEvalCsv(sessions: EvalSession[], filenameHint?: string): void {
  const header = [
    "id",
    "name",
    "age",
    "edu",
    "sex",
    "timepoint",
    "date",
    "consent_agreed",
    "consent_at",
    "module",
    "module_label",
    "score",
    "max",
    "lowerBetter",
    "detail",
    "flags",
  ];
  const rows: string[] = [header.map(csvEscape).join(",")];

  for (const s of sessions) {
    for (const m of METRICS) {
      const r = s.results?.[m.key];
      const detail = r?.detail
        ? Object.entries(r.detail)
            .map(([k, v]) => `${k}=${v}`)
            .join(" | ")
        : "";
      const flags = (r?.flags || []).join(" | ");
      const row = [
        s.id,
        s.name,
        s.age,
        s.edu,
        s.sex,
        TP_LABEL[s.timepoint] || s.timepoint,
        s.date,
        s.consent ? "Y" : "N",
        s.consent?.agreedAt || "",
        m.key,
        m.label,
        r?.score ?? "",
        r?.max ?? m.max,
        r?.lowerBetter ?? m.lowerBetter ?? "",
        detail,
        flags,
      ];
      rows.push(row.map(csvEscape).join(","));
    }
  }

  // Excel 한글 깨짐 방지 BOM
  const csv = "﻿" + rows.join("\n");
  const name = filenameHint
    ? `voicelab_eval_${filenameHint}_${tsForFilename()}.csv`
    : `voicelab_eval_${tsForFilename()}.csv`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
}

/**
 * 특정 대상자(같은 id)의 사전/중간/사후 세션을 HTML 한 장 보고서로 내보낸다.
 * 브라우저 인쇄 버튼으로 PDF 저장 가능 (허브 VHI 패턴).
 */
export function downloadEvalReport(subjectId: string, sessions: EvalSession[]): void {
  const mine = sessions
    .filter((s) => s.id === subjectId)
    .sort((a, b) => (a.timepoint === "pre" ? -1 : b.timepoint === "pre" ? 1 : a.timepoint === "mid" ? -1 : 1));
  const pre = mine.find((s) => s.timepoint === "pre");
  const mid = mine.find((s) => s.timepoint === "mid");
  const post = mine.find((s) => s.timepoint === "post");
  const subject = pre || mid || post || mine[0];
  if (!subject) return;

  const now = new Date().toLocaleString("ko-KR");

  const cell = (s: EvalSession | undefined, m: MetricMeta): string => {
    const r = s?.results?.[m.key];
    if (!r) return `<td class="c">-</td>`;
    return `<td class="c"><b>${r.score}</b><span class="sub">/${r.max}</span></td>`;
  };

  const changeCell = (m: MetricMeta): string => {
    const a = pre?.results?.[m.key]?.score;
    const b = post?.results?.[m.key]?.score;
    if (a === undefined || b === undefined) return `<td class="c">-</td>`;
    const diff = b - a;
    if (diff === 0) return `<td class="c">0</td>`;
    const better = m.lowerBetter ? diff < 0 : diff > 0;
    const sign = diff > 0 ? "+" : "";
    const cls = better ? "good" : "bad";
    return `<td class="c ${cls}"><b>${sign}${diff}</b></td>`;
  };

  const rows = METRICS.map(
    (m) => `
      <tr>
        <td class="q">${esc(m.label)}${m.lowerBetter ? ' <span class="sub">(낮을수록 좋음)</span>' : ""}</td>
        ${cell(pre, m)}
        ${cell(mid, m)}
        ${cell(post, m)}
        ${changeCell(m)}
      </tr>`,
  ).join("");

  const allFlags: string[] = [];
  for (const s of [pre, mid, post]) {
    if (!s) continue;
    for (const r of Object.values(s.results || {})) {
      for (const f of r.flags || []) {
        allFlags.push(`[${TP_LABEL[s.timepoint]}] ${f}`);
      }
    }
  }

  const detailBlock = (s: EvalSession | undefined): string => {
    if (!s) return "";
    const items = METRICS.map((m) => {
      const r = s.results?.[m.key];
      if (!r) return null;
      const det = Object.entries(r.detail)
        .map(([k, v]) => `${esc(k)} ${esc(String(v))}`)
        .join(" · ");
      return `<li><b>${esc(m.label)}</b> ${esc(String(r.score))}/${r.max} <span class="sub">${det}</span></li>`;
    }).filter(Boolean).join("");
    return `<div class="grp">${TP_LABEL[s.timepoint]} (${esc(s.date)})</div><ul class="det">${items}</ul>`;
  };

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>voicelab 평가 보고서 — ${esc(subject.name || subject.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Pretendard", "Malgun Gothic", sans-serif; color:#0f172a; max-width: 820px; margin: 0 auto; padding: 28px 26px; }
  .top { display:flex; justify-content:space-between; font-size:13px; color:#334155; }
  h1 { font-size: 22px; text-align:center; margin: 12px 0 4px; }
  .sub-title { text-align:center; color:#475569; font-size:13px; margin-bottom: 14px; }
  table { width:100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th, td { border:1px solid #cbd5e1; padding: 6px 8px; }
  th { background:#f1f5f9; }
  td.q { text-align:left; }
  td.c { text-align:center; }
  td.c .sub { color:#94a3b8; font-weight:400; font-size:11px; margin-left:2px; }
  td.good { color:#047857; }
  td.bad { color:#b91c1c; }
  .grp { margin-top: 18px; font-size:13px; font-weight:700; color:#0f172a; border-left: 3px solid #0f766e; padding-left: 8px; }
  ul.det { list-style:none; padding:0; margin: 6px 0 0; font-size:12px; }
  ul.det li { padding: 3px 0; border-bottom: 1px dashed #e2e8f0; }
  ul.det li .sub { color:#64748b; margin-left:6px; }
  .flags { margin-top: 14px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 12px; font-size:12.5px; color:#991b1b; }
  .flags b { display:block; margin-bottom:4px; }
  .foot { margin-top: 22px; font-size: 10.5px; color:#64748b; line-height:1.7; }
  .printbtn { margin: 10px 0; padding: 8px 16px; border:1px solid #cbd5e1; border-radius:8px; background:#0f172a; color:#fff; cursor:pointer; font-size:13px; }
  @media print { .printbtn { display:none; } body { padding: 0; } }
</style></head>
<body>
  <button class="printbtn" onclick="window.print()">인쇄 / PDF 저장</button>
  <div class="top">
    <span>대상자 ID: <b>${esc(subject.id)}</b> · 성함: ${esc(subject.name) || "________"}</span>
    <span>발행: ${esc(now)}</span>
  </div>
  <h1>voicelab 평가 보고서</h1>
  <p class="sub-title">지산학 사업 · 인지·언어·정서·삶의 질 사전/중간/사후 변화 요약</p>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">검사</th>
        <th class="c">사전</th>
        <th class="c">중간</th>
        <th class="c">사후</th>
        <th class="c">변화 (사후-사전)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${allFlags.length ? `<div class="flags"><b>확인 필요 (운영지침 참고)</b>${allFlags.map((f) => `<div>• ${esc(f)}</div>`).join("")}</div>` : ""}

  ${detailBlock(pre)}
  ${detailBlock(mid)}
  ${detailBlock(post)}

  <div class="foot">
    본 보고서는 변화 추적·기록 보조용이며 진단 도구가 아닙니다. 위험 신호(우울 SGDS-K ≥ 8, 지연회상 현저 저하 등)는
    치매안심센터 등 외부 전문기관 연계 운영지침에 따라 처리하세요.<br/>
    검사도구 라이선스: 인지·언어 과제는 자체 제작. SGDS-K — 조맹제 외(1999), 대한치매학회 배포본.
    WHOQOL-BREF — Translated into Korean from WHOQOL-BREF, Geneva, World Health Organization (WHO),
    1996 (https://www.who.int/tools/whoqol/whoqol-bref). WHO is not responsible for the content or
    accuracy of this translation. WHO does not endorse any specific companies, products or services.
    WHO Licence Request ID 202609140.<br/>
    생성: ${esc(now)} · voicelab 허브 · 대림대학교 언어치료학과
  </div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, `voicelab_eval_${subject.id}_report_${tsForFilename()}.html`);
}
