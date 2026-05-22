import { EMBLEM_MARK_SVG } from "../emblem";
import {
  VHI_ITEMS,
  VHI_SCALE,
  computeVhi,
  type Subscale,
} from "./vhiData";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SEVERITY_STEPS = ["정상", "살짝 좋지 않음", "좋지 않음", "심각함"];

export function downloadVhiReport(
  answers: (number | null)[],
  name: string,
): void {
  const { f, p, e, total, severity } = computeVhi(answers);
  const now = new Date().toLocaleString("ko-KR");

  const groupRows = (sub: Subscale) =>
    VHI_ITEMS.filter((it) => it.sub === sub)
      .map((it) => {
        const a = answers[it.n - 1];
        const cells = VHI_SCALE.map(
          (s) => `<td class="c">${a === s.value ? "X" : ""}</td>`,
        ).join("");
        return `<tr><td class="q"><b>${it.sub}${it.n}.</b> ${esc(it.text)}</td>${cells}</tr>`;
      })
      .join("");

  const headerCols = VHI_SCALE.map((s) => `<th class="c">${s.value}</th>`).join("");
  const sevHtml = SEVERITY_STEPS.map(
    (s) =>
      `<span class="${s === severity ? "sev-on" : "sev"}">${s}</span>`,
  ).join(" ");

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>음성장애지수 (VHI) 리포트</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; color:#0f172a; max-width: 820px; margin: 0 auto; padding: 28px 26px; position: relative; }
  .wm { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 60%; max-width: 440px; color:#1ba8db; opacity:0.06; z-index:0; pointer-events:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .wm svg { width:100%; height:auto; display:block; }
  .content { position: relative; z-index: 1; }
  .top { display:flex; justify-content:space-between; font-size:13px; color:#334155; }
  h1 { font-size: 20px; text-align:center; margin: 10px 0 4px; }
  .desc { font-size: 12px; color:#475569; line-height:1.6; }
  .legend { font-size: 12px; color:#475569; margin: 6px 0 10px; }
  table { width:100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { border:1px solid #cbd5e1; padding: 4px 7px; }
  th { background:#f1f5f9; }
  td.q { text-align:left; }
  th.c, td.c { width: 30px; text-align:center; font-weight:700; }
  .grp { margin-top: 12px; font-size:12px; font-weight:700; color:#334155; }
  .summary { margin-top: 16px; text-align:center; }
  .sev { color:#94a3b8; margin: 0 4px; }
  .sev-on { color:#b91c1c; font-weight:800; margin: 0 4px; text-decoration: underline; }
  .scores { margin-top:6px; font-size:15px; font-weight:700; }
  .foot { margin-top: 16px; font-size: 10.5px; color:#64748b; line-height:1.6; }
  .printbtn { margin: 10px 0; padding: 8px 16px; border:1px solid #cbd5e1; border-radius:8px; background:#0f172a; color:#fff; cursor:pointer; font-size:13px; }
  @media print { .printbtn { display:none; } body { padding: 0; } }
</style></head>
<body>
  <div class="wm">${EMBLEM_MARK_SVG}</div>
  <div class="content">
  <button class="printbtn" onclick="window.print()">인쇄 / PDF 저장</button>
  <div class="top"><span>이름: ${esc(name) || "________"}</span><span>검사일: ${now}</span></div>
  <h1>Voice Handicap Index (VHI)</h1>
  <p class="desc">목소리와 목소리의 삶에 대한 영향을 기술하기 위해 많은 사람들이 사용해 온 문장들입니다. 얼마나 자주 같은 경험을 하는지 응답한 결과입니다.</p>
  <p class="legend">한번도 없다 = 0 · 거의 없다 = 1 · 때때로 = 2 · 거의 항상 = 3 · 항상 = 4</p>

  <div class="grp">신체 (Physical)</div>
  <table><thead><tr><th></th>${headerCols}</tr></thead><tbody>${groupRows("P")}</tbody></table>
  <div class="grp">기능 (Functional)</div>
  <table><thead><tr><th></th>${headerCols}</tr></thead><tbody>${groupRows("F")}</tbody></table>
  <div class="grp">정서 (Emotional)</div>
  <table><thead><tr><th></th>${headerCols}</tr></thead><tbody>${groupRows("E")}</tbody></table>

  <div class="summary">
    <div>오늘 당신의 목소리 상태는 어떤가요?: ${sevHtml}</div>
    <div class="scores">P: ${p} , F: ${f} , E: ${e} · 총점: ${total} / 120</div>
  </div>

  <div class="foot">
    근거: Jacobson 외 (1997) Am.J.Speech Lang.Pathol. 6:66-70 · 김재옥 외 (2007) 음성과학 14:111-125.
    선별 절단점 ≈ 15점, 임상적 유의 변화(MCID) ≈ 18점. 중증도 구간(정상 0–14 · 살짝 좋지 않음 15–30 · 좋지 않음 31–60 · 심각함 61–120)은 해석 보조용입니다.<br/>
    생성: ${esc(now)} · 대림대학교 Voice Lab
  </div>
  </div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.download = `vhi_${ts}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
