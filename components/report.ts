/**
 * 모듈 공용 검사 리포트 다운로드 — 자기완결 HTML 파일로 저장.
 * 외부 라이브러리 없이 인쇄 친화적 HTML 을 생성하고 다운로드한다.
 * 사용자가 열어 Ctrl/Cmd+P 로 PDF 저장 가능.
 */
export interface ReportRow {
  label: string;
  value: string;
  ref?: string;
  status?: "normal" | "abnormal" | null;
}
export interface ReportSection {
  heading: string;
  rows: ReportRow[];
}
export interface ReportSpec {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  footnote?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(spec: ReportSpec): string {
  const now = new Date();
  const dateStr = now.toLocaleString("ko-KR");
  const sectionsHtml = spec.sections
    .map((sec) => {
      const rows = sec.rows
        .map((r) => {
          const badge =
            r.status === "normal"
              ? `<span class="badge ok">정상</span>`
              : r.status === "abnormal"
                ? `<span class="badge bad">이상</span>`
                : r.ref
                  ? ``
                  : `<span class="badge ref">참고</span>`;
          return `<tr><td>${esc(r.label)}</td><td class="num">${esc(r.value)}</td><td class="ref">${esc(r.ref ?? "")}</td><td>${badge}</td></tr>`;
        })
        .join("");
      return `<h2>${esc(sec.heading)}</h2><table><thead><tr><th>지표</th><th>값</th><th>정상 기준</th><th>판정</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(spec.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; color:#0f172a; max-width: 800px; margin: 0 auto; padding: 32px 28px; }
  h1 { font-size: 22px; margin: 0; }
  .sub { color:#64748b; font-size: 13px; margin-top: 2px; }
  .meta { display:flex; flex-wrap:wrap; gap: 8px 28px; margin: 18px 0 8px; font-size: 14px; }
  .meta .blank { border-bottom: 1px solid #94a3b8; min-width: 110px; display: inline-block; }
  h2 { font-size: 14px; margin: 22px 0 6px; color:#334155; border-left: 4px solid #64748b; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  td.ref { color:#64748b; }
  .badge { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
  .badge.ok { background:#dcfce7; color:#166534; }
  .badge.bad { background:#ffe4e6; color:#9f1239; }
  .badge.ref { background:#f1f5f9; color:#64748b; }
  .foot { margin-top: 20px; font-size: 11px; color:#64748b; line-height: 1.6; }
  .genat { margin-top: 4px; font-size: 11px; color:#94a3b8; }
  .printbtn { margin: 16px 0; padding: 8px 16px; border:1px solid #cbd5e1; border-radius:8px; background:#0f172a; color:#fff; cursor:pointer; font-size:13px; }
  @media print { .printbtn { display:none; } body { padding: 0; } }
</style></head>
<body>
  <button class="printbtn" onclick="window.print()">인쇄 / PDF 저장</button>
  <h1>${esc(spec.title)}</h1>
  ${spec.subtitle ? `<div class="sub">${esc(spec.subtitle)}</div>` : ""}
  <div class="meta">
    <span>대상자 <span class="blank"></span></span>
    <span>평가자 <span class="blank"></span></span>
    <span>검사일 <span class="blank"></span></span>
  </div>
  ${sectionsHtml}
  ${spec.footnote ? `<div class="foot">${esc(spec.footnote)}</div>` : ""}
  <div class="genat">생성: ${esc(dateStr)} · 대림대학교 Voice Lab</div>
</body></html>`;
}

export function downloadReport(spec: ReportSpec, filenameBase: string): void {
  const html = buildHtml(spec);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.download = `${filenameBase}_${ts}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
