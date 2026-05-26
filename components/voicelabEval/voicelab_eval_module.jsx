import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { saveSession, listSessions } from "./evalStorage";

/*
 voicelab 허브 · 지산학 사업 평가 모듈
 진행 순서: ① 지남력·기억(자체 과제) ② 이름대기 ③ 생성이름대기(의미유창성)
          ④ 숫자 외우기 ⑤ 담화(이야기 다시말하기) ⑥ 우울(SGDS-K) ⑦ 삶의 질(WHOQOL-BREF)
 라이선스 정리:
 - 인지(지남력·기억)·이름대기·유창성·숫자외우기·담화 → 자체 제작/공용 패러다임. 그대로 사용 가능.
   (K-MMSE는 유료, CIST는 전산평가 불가·배포금지 → 앱 미내장. 본 모듈은 '진단'이 아닌 '변화추적'.)
 - 우울(SGDS-K) → GDS 원판 공유저작물 + 대한치매학회 배포 한국판. 공식 배포본 문항·출처표기로 사용.
 - 삶의질(WHOQOL-BREF) → WHO 허가 승인 후, who.int 공식 한국어판 문항으로 교체하여 사용.
 - 사전/중간/사후 저장·비교 지원. 저장 백엔드는 ./evalStorage.ts 의 saveSession/listSessions 한 곳에서만
   교체하면 됨 (지금은 허브 localStorage, 정식 운영 시 hub API fetch 로 교체).
*/

const TPS = { pre: "사전", mid: "중간", post: "사후" };

// ---------- shared UI ----------
const Card = ({ children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">{children}</div>
);
const Btn = ({ children, onClick, kind = "primary", disabled }) => {
  const base = "px-5 py-3 rounded-xl text-lg font-semibold transition active:scale-95 disabled:opacity-40";
  const styles = {
    primary: "bg-teal-700 text-white hover:bg-teal-800",
    ghost: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    ok: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${styles[kind]}`}>{children}</button>;
};
const Pill = ({ active, children, onClick }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-full text-base font-semibold border-2 transition ${active ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-slate-300 hover:border-teal-500"}`}>{children}</button>
);
const OXButtons = ({ value, onSet }) => (
  <div className="flex gap-2">
    <button onClick={() => onSet(1)} className={`w-12 h-10 rounded-lg font-bold ${value === 1 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>O</button>
    <button onClick={() => onSet(0)} className={`w-12 h-10 rounded-lg font-bold ${value === 0 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500"}`}>X</button>
  </div>
);

// =================================================================
// MODULE 1A. 인지 — 지남력 + 단어 외우기(등록)   [이름대기 전에 시행]
// MODULE 1B. 인지 — 지연회상 + 재인              [이름대기 후에 시행]
//  임상 표준 순서: 등록 → 간섭과제(이름대기) → 지연회상.
//  · 지남력(시간5 + 장소5)  · 즉시기억(3단어 ×3시행, 사람채점)
//  · 지연회상(3단어, 사람채점)  · 재인(보기 4지선다, 자동채점)
// =================================================================
const ORI_TIME = ["연도", "계절", "월", "날짜(일)", "요일"];
const ORI_PLACE = ["나라", "시/도", "구/군", "여기는 무엇을 하는 곳", "건물(층/이름)"];
const MEM_WORDS = ["나무", "자동차", "모자"];
// 재인 보기: 정답 + 의미 유사 방해자극 3개
const RECOG = [
  { target: "나무", options: ["꽃", "나무", "바위", "구름"] },
  { target: "자동차", options: ["자동차", "비행기", "자전거", "기차"] },
  { target: "모자", options: ["신발", "장갑", "모자", "목도리"] },
];
const CogRow = ({ label, k, obj, set }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100">
    <span className="text-lg text-slate-700">{label}</span>
    <OXButtons value={obj[k]} onSet={(v) => set({ ...obj, [k]: v })} />
  </div>
);

// --- 1A. 지남력 + 즉시기억 등록 (이름대기 전) ---
function ModCogReg({ onDone }) {
  const [phase, setPhase] = useState("orient"); // orient → register
  const [ori, setOri] = useState({});
  const [reg, setReg] = useState({ t1: {}, t2: {}, t3: {} });
  const oriScore = Object.values(ori).filter((x) => x === 1).length;
  const regTrials = ["t1", "t2", "t3"].map((t) => MEM_WORDS.filter((_, i) => reg[t]["w" + i] === 1).length);
  const regBest = Math.max(...regTrials);

  if (phase === "orient") {
    return (
      <div className="space-y-5">
        <p className="text-slate-500">검사자가 묻고 정/오를 표시하세요. (화면·주변에 날짜·장소 단서가 보이지 않게 주의)</p>
        <div>
          <h3 className="font-bold text-lg mb-2 text-teal-800">지남력 — 시간 (5점)</h3>
          {ORI_TIME.map((t, i) => <CogRow key={"t" + i} label={t} k={"t" + i} obj={ori} set={setOri} />)}
          <h3 className="font-bold text-lg mt-4 mb-2 text-teal-800">지남력 — 장소 (5점)</h3>
          {ORI_PLACE.map((t, i) => <CogRow key={"p" + i} label={t} k={"p" + i} obj={ori} set={setOri} />)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">지남력 {oriScore}/10</span>
          <Btn onClick={() => setPhase("register")}>다음: 단어 외우기</Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 rounded-xl p-4">
        <p className="font-semibold text-amber-900 mb-1">즉시기억 (등록)</p>
        <p className="text-slate-600">아래 세 단어를 또렷이 불러 주고 따라 말하게 하세요. 외울 때까지 최대 3회 반복하고, 시행별로 맞힌 단어를 표시합니다. <b className="text-amber-900">조금 뒤에 다시 여쭤볼 거라고 미리 알려 주세요.</b></p>
        <p className="text-2xl font-bold text-teal-800 text-center my-3">{MEM_WORDS.join("  ·  ")}</p>
      </div>
      {["t1", "t2", "t3"].map((t, ti) => (
        <div key={t} className="bg-slate-50 rounded-xl p-3">
          <p className="font-semibold text-slate-600 mb-1">{ti + 1}차 시행</p>
          <div className="flex gap-2">
            {MEM_WORDS.map((w, i) => (
              <button key={i} onClick={() => setReg({ ...reg, [t]: { ...reg[t], ["w" + i]: reg[t]["w" + i] === 1 ? 0 : 1 } })}
                className={`flex-1 h-11 rounded-lg font-bold ${reg[t]["w" + i] === 1 ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-400"}`}>{w}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-teal-800">
        <p className="font-semibold">다음은 이름대기 과제입니다.</p>
        <p className="text-sm">이름대기가 간섭과제(시간 지연) 역할을 합니다. 이름대기를 마치면 ‘인지 — 지연회상·재인’ 단계에서 방금 외운 단어를 다시 여쭤봅니다.</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">즉시기억 최고 {regBest}/3</span>
        <Btn onClick={() => onDone({
          score: oriScore + regBest, max: 13,
          detail: { 지남력: `${oriScore}/10`, 즉시기억: `${regBest}/3` },
          flags: [],
        })}>다음: 이름대기 →</Btn>
      </div>
    </div>
  );
}

// --- 1B. 지연회상 + 재인 (이름대기 후) ---
function ModCogRecall({ onDone }) {
  const [phase, setPhase] = useState("recall"); // recall → recognize
  const [recall, setRecall] = useState({});
  const [recog, setRecog] = useState({});
  const recallScore = Object.values(recall).filter((x) => x === 1).length;
  const recogScore = RECOG.filter((r, i) => recog[i] === r.target).length;

  if (phase === "recall") {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="font-semibold text-amber-900 mb-1">지연회상 (자유회상 · 사람 채점)</p>
          <p className="text-slate-600">“아까(이름대기 전에) 외우셨던 단어 세 개를 말씀해 주세요.” 단서 없이 스스로 말한 단어만 O로 표시하세요.</p>
        </div>
        {MEM_WORDS.map((w, i) => <CogRow key={"r" + i} label={`회상: ${w}`} k={"r" + i} obj={recall} set={setRecall} />)}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">지연회상 {recallScore}/3</span>
          <Btn onClick={() => setPhase("recognize")}>다음: 재인</Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 rounded-xl p-4">
        <p className="font-semibold text-emerald-900 mb-1">재인 (보기 선택 · 자동 채점)</p>
        <p className="text-slate-600">회상하지 못한 단어를 보기에서 고르게 하세요. 어르신이 고른 보기를 누르면 자동 채점됩니다.</p>
      </div>
      {RECOG.map((r, i) => (
        <div key={i} className="bg-slate-50 rounded-xl p-3">
          <p className="font-semibold text-slate-600 mb-2">{i + 1}. 어느 것을 외우셨나요?</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {r.options.map((o) => (
              <button key={o} onClick={() => setRecog({ ...recog, [i]: o })}
                className={`h-11 rounded-lg font-bold ${recog[i] === o ? (o === r.target ? "bg-emerald-600 text-white" : "bg-rose-500 text-white") : "bg-white border border-slate-200 text-slate-500"}`}>{o}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">지연회상 {recallScore}/3 · 재인 {recogScore}/3</span>
        <Btn onClick={() => onDone({
          score: recallScore + recogScore, max: 6,
          detail: { 지연회상: `${recallScore}/3`, 재인: `${recogScore}/3` },
          flags: recallScore <= 1 ? ["지연회상 낮음(≤1/3) — 추적/연계 고려"] : [],
        })}>다음</Btn>
      </div>
    </div>
  );
}

// =================================================================
// MODULE 2. 이름대기 (대면이름대기 · 자체 제작)
// =================================================================
const NAMING = ["사과", "시계", "우산", "안경", "가방", "주전자", "빗자루", "돋보기", "다리미", "자전거", "코끼리", "절구", "호미", "부채", "가위"];
function ModNaming({ onDone }) {
  const [res, setRes] = useState({});
  const set = (i, v) => setRes({ ...res, [i]: v });
  const O = Object.values(res).filter((x) => x === "O").length;
  const C = Object.values(res).filter((x) => x === "C").length;
  return (
    <div className="space-y-4">
      <p className="text-slate-500">그림카드를 보여 주고 명명 결과를 표시하세요. (O 정반응 / C 단서 후 정반응 / X 오반응)</p>
      <div className="grid gap-2">
        {NAMING.map((w, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2">
            <span className="text-lg font-semibold text-slate-700">{i + 1}. {w}</span>
            <div className="flex gap-1.5">
              {["O", "C", "X"].map((v) => (
                <button key={v} onClick={() => set(i, v)}
                  className={`w-11 h-10 rounded-lg font-bold ${res[i] === v ? (v === "O" ? "bg-emerald-600 text-white" : v === "C" ? "bg-amber-500 text-white" : "bg-rose-500 text-white") : "bg-white border border-slate-200 text-slate-400"}`}>{v}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">정반응 {O}/15 (단서후 {C})</span>
        <Btn onClick={() => onDone({ score: O, max: 15, detail: { 정반응: `${O}/15`, 단서후정반응: C }, flags: [] })}>다음</Btn>
      </div>
    </div>
  );
}

// =================================================================
// MODULE 3. 생성이름대기 (의미유창성 동물 / 음소 ㄱ)
// =================================================================
function FluencyTrial({ label, hint, value, onChange }) {
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(60);
  const ref = useRef(null);
  useEffect(() => () => clearInterval(ref.current), []);
  const start = () => {
    setLeft(60); setRunning(true);
    ref.current = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(ref.current); setRunning(false); return 0; } return l - 1; }), 1000);
  };
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-lg text-teal-800">{label}</span>
        <span className={`text-2xl font-mono font-bold ${left <= 10 && running ? "text-rose-600" : "text-slate-700"}`}>{left}s</span>
      </div>
      <p className="text-slate-500 mb-3">{hint}</p>
      <div className="flex items-center gap-3">
        <Btn kind={running ? "ghost" : "primary"} onClick={start}>{running ? "진행 중…" : "60초 시작"}</Btn>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => onChange(Math.max(0, value - 1))} className="w-11 h-11 rounded-lg bg-slate-200 text-2xl font-bold">–</button>
          <span className="w-16 text-center text-3xl font-bold text-teal-700">{value}</span>
          <button onClick={() => onChange(value + 1)} className="w-11 h-11 rounded-lg bg-teal-600 text-white text-2xl font-bold">+</button>
        </div>
      </div>
      <p className="text-sm text-slate-400 mt-2">유효 단어가 나올 때마다 + 를 누르세요(중복·오류 제외).</p>
    </div>
  );
}
function ModFluency({ onDone }) {
  const [animal, setAnimal] = useState(0);
  const [phon, setPhon] = useState(0);
  return (
    <div className="space-y-4">
      <p className="text-slate-500">1분 동안 해당하는 단어를 최대한 많이 말하게 합니다(COWAT 방식). 정상 노인은 ‘동물’에서 대략 15개 내외(연령·교육수준에 따라 변동). 본 모듈은 사전·사후 변화 비교가 주 목적입니다.</p>
      <FluencyTrial label="의미유창성 — 동물" hint="“동물 이름을 1분 동안 최대한 많이 말씀해 주세요.”" value={animal} onChange={setAnimal} />
      <FluencyTrial label="음소유창성 — ‘ㄱ’ (선택)" hint="“‘ㄱ’으로 시작하는 낱말을 1분 동안 말씀해 주세요.”" value={phon} onChange={setPhon} />
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">동물 {animal}개 · ‘ㄱ’ {phon}개</span>
        <Btn onClick={() => onDone({ score: animal, max: 30, detail: { 동물: animal, "음소ㄱ": phon }, flags: animal < 12 ? ["의미유창성 낮음(<12) — 추적 권장"] : [] })}>다음</Btn>
      </div>
    </div>
  );
}

// =================================================================
// MODULE 4. 숫자 외우기 (digit span)
// =================================================================
const FWD = ["5-8-2", "7-2-9-4", "3-8-1-6-9", "9-4-7-2-5-8", "1-6-3-8-2-7-4", "4-9-1-7-3-8-2-5"];
const BWD = ["4-7", "6-2-9", "8-3-5-1", "2-9-4-6-1", "7-1-5-2-8-3"];
function SpanBlock({ title, seqs, baseLen, value, onChange }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="font-bold text-lg text-teal-800 mb-2">{title}</p>
      <p className="text-slate-500 mb-3">한 자리씩 또박또박 불러 주고, 성공한 가장 긴 자릿수를 누르세요.</p>
      <div className="space-y-1.5">
        {seqs.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="font-mono text-lg tracking-widest text-slate-700">{baseLen + i}자리: {s}</span>
            <button onClick={() => onChange(value === baseLen + i ? 0 : baseLen + i)}
              className={`px-4 py-1.5 rounded-lg font-bold ${value === baseLen + i ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-400"}`}>성공</button>
          </div>
        ))}
      </div>
    </div>
  );
}
function ModDigit({ onDone }) {
  const [fwd, setFwd] = useState(0);
  const [bwd, setBwd] = useState(0);
  return (
    <div className="space-y-4">
      <SpanBlock title="바로 따라하기 (forward)" seqs={FWD} baseLen={3} value={fwd} onChange={setFwd} />
      <SpanBlock title="거꾸로 말하기 (backward)" seqs={BWD} baseLen={2} value={bwd} onChange={setBwd} />
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">바로 {fwd}자리 · 거꾸로 {bwd}자리</span>
        <Btn onClick={() => onDone({ score: fwd + bwd, max: 13, detail: { 바로: fwd, 거꾸로: bwd }, flags: [] })}>다음</Btn>
      </div>
    </div>
  );
}

// =================================================================
// MODULE 5. 담화 — 이야기 다시 말하기 (자체 제작)
// =================================================================
const STORY = "옛날 어느 시골 마을에 김 할머니가 살았습니다. 할머니는 작은 텃밭에서 배추와 무를 키웠습니다. 어느 가을 아침, 할머니는 시장에 가려고 채소를 바구니에 담았습니다. 그런데 키우던 강아지 ‘복실이’가 바구니를 따라 마을 어귀까지 졸졸 쫓아왔습니다. 할머니는 웃으며 복실이를 데리고 함께 시장에 갔습니다.";
const UNITS = ["시골 마을", "김 할머니", "텃밭", "배추와 무", "가을 아침", "시장에 가려고", "바구니에 담음", "강아지 복실이", "마을 어귀까지 따라옴", "함께 시장에 감"];
function ModDiscourse({ onDone }) {
  const [chk, setChk] = useState({});
  const n = Object.values(chk).filter(Boolean).length;
  return (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <p className="font-semibold text-teal-900 mb-1">검사자 낭독 지문</p>
        <p className="text-lg leading-relaxed text-slate-700">{STORY}</p>
      </div>
      <p className="text-slate-500">“들은 대로 이야기해 주세요.” 어르신이 회상한 핵심 정보를 임상가가 체크하세요.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {UNITS.map((u, i) => (
          <label key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border-2 ${chk[i] ? "bg-emerald-50 border-emerald-400" : "bg-white border-slate-200"}`}>
            <input type="checkbox" checked={!!chk[i]} onChange={(e) => setChk({ ...chk, [i]: e.target.checked })} className="w-5 h-5 accent-emerald-600" />
            <span className="text-lg text-slate-700">{u}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">회상 정보 {n}/10</span>
        <Btn onClick={() => onDone({ score: n, max: 10, detail: { 정보단위: `${n}/10` }, flags: [] })}>다음</Btn>
      </div>
    </div>
  );
}

// =================================================================
// MODULE 6. 우울 — SGDS-K (한국판 단축형 노인우울척도, 15문항 예/아니오, 절단점 8)
//
// 출처(Source):
//   조맹제, 배재남, 서국희, 함봉진, 김장규, 이동우 외 (1999).
//   "한국판 단축형 노인우울척도(SGDS-K)의 표준화 연구."
//   신경정신의학(J Korean Neuropsychiatr Assoc), 38(1), 48–63.
//   대한치매학회(Korean Dementia Association) 평가도구 배포본 기준.
//
// 원판: Sheikh JI, Yesavage JA. Geriatric Depression Scale (GDS-SF, 1986) — 공유저작물.
// 본 코드의 문항 문구는 위 표준화본을 기준으로 작성되었습니다. 임상 운영 시
// 대한치매학회 배포 PDF의 최신본 문구와 한 번 더 대조 확인 후 사용하세요.
// 채점 규칙: 우울 방향 응답 = 1점 / 그 외 = 0점, 합 0–15. 절단점 8 이상이면 우울 의심.
// =================================================================
const GDS = [
  { q: "현재의 자기 생활에 대체로 만족하십니까?", pos: true },                              //  1 (아니오=우울)
  { q: "요즘 들어 활동량이나 의욕이 많이 떨어지셨습니까?", pos: false },                    //  2 (예=우울)
  { q: "자신이 헛되이 살고 있다고 느끼십니까?", pos: false },                                //  3 (예=우울)
  { q: "생활이 지루하게 느껴질 때가 많습니까?", pos: false },                                //  4 (예=우울)
  { q: "평소에 기분은 상쾌한 편이십니까?", pos: true },                                      //  5 (아니오=우울)
  { q: "자신에게 불길한 일이 닥칠 것 같아 불안하십니까?", pos: false },                      //  6 (예=우울)
  { q: "대체로 마음이 즐거운 편이십니까?", pos: true },                                      //  7 (아니오=우울)
  { q: "절망적이라는 느낌이 자주 드십니까?", pos: false },                                    //  8 (예=우울)
  { q: "바깥에 나가기보다는 집에 있기를 좋아하십니까?", pos: false },                        //  9 (예=우울)
  { q: "비슷한 나이의 다른 노인들보다 기억력이 나쁘다고 느끼십니까?", pos: false },          // 10 (예=우울)
  { q: "현재 살아 있다는 것이 즐겁게 생각되십니까?", pos: true },                            // 11 (아니오=우울)
  { q: "지금의 내 모습이 아무 쓸모없는 사람이라고 느끼십니까?", pos: false },                // 12 (예=우울)
  { q: "기력이 좋은 편이십니까?", pos: true },                                                // 13 (아니오=우울)
  { q: "지금 자신의 처지가 절망적이라고 생각하십니까?", pos: false },                        // 14 (예=우울)
  { q: "자신의 처지가 다른 사람들에 비해 더 못하다고 생각하십니까?", pos: false },           // 15 (예=우울)
];
function ModGDS({ onDone }) {
  const [ans, setAns] = useState({});
  const done = Object.keys(ans).length === 15;
  const score = GDS.reduce((s, it, i) => {
    if (ans[i] === undefined) return s;
    const depressive = it.pos ? ans[i] === "no" : ans[i] === "yes";
    return s + (depressive ? 1 : 0);
  }, 0);
  return (
    <div className="space-y-3">
      <p className="text-slate-500">예/아니오로 답하게 하세요. (절단점 8점 이상 → 우울 가능성, 전문 상담/연계 권유)</p>
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
        <b>SGDS-K</b> · 한국판 단축형 노인우울척도 (15문항). 출처: 조맹제 외(1999), 신경정신의학 38(1), 48–63;
        대한치매학회 평가도구 배포본. 원판: Sheikh &amp; Yesavage (1986) GDS-SF (공유저작물).
      </p>
      {GDS.map((it, i) => (
        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2">
          <span className="text-lg text-slate-700 pr-3">{i + 1}. {it.q}</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setAns({ ...ans, [i]: "yes" })} className={`w-16 h-10 rounded-lg font-bold ${ans[i] === "yes" ? "bg-teal-700 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>예</button>
            <button onClick={() => setAns({ ...ans, [i]: "no" })} className={`w-16 h-10 rounded-lg font-bold ${ans[i] === "no" ? "bg-teal-700 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>아니오</button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className={`text-lg font-semibold ${score >= 8 ? "text-rose-600" : "text-slate-700"}`}>총점 {score}/15 {score >= 8 ? "· 우울 의심" : ""}</span>
        <Btn disabled={!done} onClick={() => onDone({ score, max: 15, detail: { 총점: `${score}/15` }, flags: score >= 8 ? ["우울 선별 양성(≥8) — 전문 상담/연계 권장"] : [], lowerBetter: true })}>다음</Btn>
      </div>
    </div>
  );
}

// =================================================================
// MODULE 7. 삶의 질 — WHOQOL-BREF (26문항, 1~5)
//  ※ WHO 허가 승인 후 who.int 공식 한국어판 문항으로 교체. 채점(영역 0~100)은 동일.
// =================================================================
const QOL = [
  { q: "전반적인 삶의 질에 만족하십니까?", d: "전반" },
  { q: "전반적인 건강 상태에 만족하십니까?", d: "전반" },
  { q: "통증 때문에 하고 싶은 일을 못 하십니까?", d: "신체", r: true },
  { q: "치료(약)에 의존해야 일상이 가능합니까?", d: "신체", r: true },
  { q: "삶을 즐기는 편이십니까?", d: "심리" },
  { q: "삶이 의미 있다고 느끼십니까?", d: "심리" },
  { q: "집중을 잘 하십니까?", d: "심리" },
  { q: "일상생활이 안전하다고 느끼십니까?", d: "환경" },
  { q: "주변 환경이 건강에 좋습니까?", d: "환경" },
  { q: "일상생활을 할 기운(체력)이 있으십니까?", d: "신체" },
  { q: "자신의 모습(외모 등)을 받아들이십니까?", d: "심리" },
  { q: "필요한 돈(생활비)이 충분하십니까?", d: "환경" },
  { q: "필요한 정보를 얻을 수 있으십니까?", d: "환경" },
  { q: "여가 활동을 할 기회가 있으십니까?", d: "환경" },
  { q: "잘 돌아다닐(이동) 수 있으십니까?", d: "신체" },
  { q: "잠을 잘 주무십니까?", d: "신체" },
  { q: "일상 활동을 잘 수행하십니까?", d: "신체" },
  { q: "일할(활동할) 능력에 만족하십니까?", d: "신체" },
  { q: "자기 자신에 만족하십니까?", d: "심리" },
  { q: "주변 사람들과의 관계에 만족하십니까?", d: "사회" },
  { q: "성생활/친밀감에 만족하십니까?", d: "사회" },
  { q: "친구·이웃의 도움에 만족하십니까?", d: "사회" },
  { q: "사는 곳(주거)에 만족하십니까?", d: "환경" },
  { q: "의료·복지 서비스 이용이 편리합니까?", d: "환경" },
  { q: "교통 이용이 편리합니까?", d: "환경" },
  { q: "우울·불안 같은 부정적 기분을 자주 느끼십니까?", d: "심리", r: true },
];
const DOMAINS = ["신체", "심리", "사회", "환경"];
function ModQOL({ onDone }) {
  const [ans, setAns] = useState({});
  const done = Object.keys(ans).length === 26;
  const domScore = (dom) => {
    const items = QOL.map((it, i) => ({ it, i })).filter((x) => x.it.d === dom && ans[x.i] !== undefined);
    if (!items.length) return null;
    const vals = items.map((x) => (x.it.r ? 6 - ans[x.i] : ans[x.i]));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(((mean * 4 - 4) * (100 / 16)));
  };
  return (
    <div className="space-y-3">
      <p className="text-slate-500">1(전혀 아니다) ~ 5(매우 그렇다)로 답하게 하세요. 영역점수가 높을수록 삶의 질이 좋음(진단 절단점 없음, 변화 추적용).</p>
      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">※ WHO 허가 승인 후 who.int 공식 한국어판 26문항·출처표기로 교체하세요(채점 동일).</p>
      {QOL.map((it, i) => (
        <div key={i} className="bg-slate-50 rounded-xl px-4 py-3">
          <p className="text-lg text-slate-700 mb-2">{i + 1}. {it.q} <span className="text-xs text-slate-400">[{it.d}]</span></p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} onClick={() => setAns({ ...ans, [i]: v })} className={`flex-1 h-10 rounded-lg font-bold ${ans[i] === v ? "bg-teal-700 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>{v}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{DOMAINS.map((d) => `${d} ${domScore(d) ?? "-"}`).join(" · ")}</span>
        <Btn disabled={!done} onClick={() => {
          const detail = {}; DOMAINS.forEach((d) => detail[d] = domScore(d));
          const overall = Math.round(DOMAINS.reduce((a, d) => a + (domScore(d) || 0), 0) / DOMAINS.length);
          onDone({ score: overall, max: 100, detail, flags: [] });
        }}>완료</Btn>
      </div>
    </div>
  );
}

// =================================================================
// 모듈 순서 정의
// =================================================================
const MODULES = [
  { key: "cog_reg", name: "인지 — 지남력·단어 외우기", comp: ModCogReg },
  { key: "naming", name: "이름대기", comp: ModNaming },
  { key: "cog_recall", name: "인지 — 지연회상·재인", comp: ModCogRecall },
  { key: "fluency", name: "생성이름대기 (유창성)", comp: ModFluency },
  { key: "digit", name: "숫자 외우기", comp: ModDigit },
  { key: "discourse", name: "담화 (이야기 다시말하기)", comp: ModDiscourse },
  { key: "gds", name: "우울 (SGDS-K)", comp: ModGDS },
  { key: "qol", name: "삶의 질 (WHOQOL-BREF)", comp: ModQOL },
];

// =================================================================
// 메인 앱
// =================================================================
export default function App() {
  const [screen, setScreen] = useState("home");
  const [info, setInfo] = useState({ id: "", name: "", age: "", edu: "", sex: "" });
  const [timepoint, setTimepoint] = useState("pre");
  const [step, setStep] = useState(0);
  const [results, setResults] = useState({});
  const [sessions, setSessions] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => { listSessions().then(setSessions); }, [screen]);

  const startEval = () => { setResults({}); setStep(0); setSaved(false); setScreen("eval"); };
  const onModuleDone = (key, r) => {
    const nr = { ...results, [key]: r };
    setResults(nr);
    if (step + 1 < MODULES.length) setStep(step + 1);
    else setScreen("result");
  };
  const finalize = async () => {
    const s = { id: info.id || ("익명-" + Date.now()), name: info.name, age: info.age, edu: info.edu, sex: info.sex, timepoint, date: new Date().toISOString().slice(0, 10), results };
    await saveSession(s);
    setSaved(true);
    const all = await listSessions(); setSessions(all);
  };
  const allFlags = Object.values(results).flatMap((r) => r.flags || []);

  if (screen === "home") {
    const ids = [...new Set(sessions.map((s) => s.id))];
    return (
      <Shell sub="지산학 사업 · 인지·언어·정서·삶의 질 평가">
        <Card>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">새 평가 시작</h2>
          <p className="text-slate-500 mb-5">대상자 정보와 평가 시점을 입력하세요.</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="대상자 ID" v={info.id} on={(v) => setInfo({ ...info, id: v })} ph="예: A-001" />
            <Field label="성함" v={info.name} on={(v) => setInfo({ ...info, name: v })} />
            <Field label="나이" v={info.age} on={(v) => setInfo({ ...info, age: v })} ph="세" />
            <Field label="교육 연수" v={info.edu} on={(v) => setInfo({ ...info, edu: v })} ph="년" />
          </div>
          <p className="font-semibold text-slate-700 mb-2">평가 시점</p>
          <div className="flex gap-2 mb-6">
            {Object.entries(TPS).map(([k, v]) => <Pill key={k} active={timepoint === k} onClick={() => setTimepoint(k)}>{v}</Pill>)}
          </div>
          <div className="flex gap-3">
            <Btn onClick={startEval} disabled={!info.id}>평가 시작 →</Btn>
            <Btn kind="ghost" onClick={() => setScreen("compare")}>사전·사후 비교 보기</Btn>
          </div>
          {!info.id && <p className="text-sm text-rose-400 mt-2">대상자 ID를 입력하면 시작할 수 있어요.</p>}
        </Card>
        {ids.length > 0 && (
          <Card>
            <h3 className="font-bold text-lg text-slate-700 mb-3">저장된 대상자 ({ids.length})</h3>
            <div className="flex flex-wrap gap-2">
              {ids.map((id) => {
                const tps = sessions.filter((s) => s.id === id).map((s) => TPS[s.timepoint]);
                return <span key={id} className="px-3 py-1.5 bg-slate-100 rounded-lg text-slate-600">{id} <span className="text-teal-600">({[...new Set(tps)].join(",")})</span></span>;
              })}
            </div>
          </Card>
        )}
      </Shell>
    );
  }

  if (screen === "eval") {
    const M = MODULES[step];
    const Comp = M.comp;
    return (
      <Shell sub={`${info.name || info.id} · ${TPS[timepoint]} 평가`}>
        <div className="flex items-center gap-1.5 mb-4">
          {MODULES.map((m, i) => (
            <div key={m.key} className={`h-2 flex-1 rounded-full ${i < step ? "bg-teal-600" : i === step ? "bg-teal-400" : "bg-slate-200"}`} />
          ))}
        </div>
        <Card>
          <p className="text-teal-600 font-semibold">{step + 1} / {MODULES.length}</p>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">{M.name}</h2>
          <Comp onDone={(r) => onModuleDone(M.key, r)} />
        </Card>
        <button onClick={() => setScreen("home")} className="text-slate-400 mt-4 hover:text-slate-600">← 처음으로(저장 안 됨)</button>
      </Shell>
    );
  }

  if (screen === "result") {
    return (
      <Shell sub={`${info.name || info.id} · ${TPS[timepoint]} 결과`}>
        <Card>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">평가 결과 요약</h2>
          <div className="space-y-2">
            {MODULES.map((m) => {
              const r = results[m.key]; if (!r) return null;
              return (
                <div key={m.key} className="flex items-center justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-700 font-medium">{m.name}</span>
                  <span className="text-slate-600 text-right">{Object.entries(r.detail).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>
                </div>
              );
            })}
          </div>
          {allFlags.length > 0 && (
            <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="font-semibold text-rose-700 mb-1">확인 필요</p>
              {allFlags.map((f, i) => <p key={i} className="text-rose-600">• {f}</p>)}
            </div>
          )}
          <div className="flex gap-3 mt-6">
            {!saved ? <Btn kind="ok" onClick={finalize}>결과 저장</Btn> : <span className="px-5 py-3 text-emerald-700 font-semibold">✓ 저장됨</span>}
            <Btn kind="ghost" onClick={() => setScreen("compare")}>사전·사후 비교</Btn>
            <Btn kind="ghost" onClick={() => setScreen("home")}>처음으로</Btn>
          </div>
        </Card>
      </Shell>
    );
  }

  if (screen === "compare") {
    const ids = [...new Set(sessions.map((s) => s.id))];
    return <Compare ids={ids} sessions={sessions} onBack={() => setScreen("home")} />;
  }
  return null;
}

function Field({ label, v, on, ph }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph}
        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-lg focus:border-teal-500 focus:outline-none" />
    </label>
  );
}

function Shell({ children, sub }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 py-6 px-4" style={{ fontFamily: "'Pretendard','Malgun Gothic',system-ui,sans-serif" }}>
      <div className="max-w-3xl mx-auto">
        <header className="mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white grid place-items-center font-black">V</div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 leading-none">voicelab 평가 모듈</h1>
              <p className="text-sm text-slate-500">{sub}</p>
            </div>
          </div>
        </header>
        <div className="space-y-4">{children}</div>
        <p className="text-center text-xs text-slate-400 mt-8">인지·언어 과제는 자체 제작. 우울(SGDS-K)·삶의질(WHOQOL-BREF)은 공식 문항/허가 적용 후 정식 운영하세요. 본 모듈은 변화 추적·기록 보조용이며 진단 도구가 아닙니다.</p>
      </div>
    </div>
  );
}

const METRICS = [
  { key: "cog_reg", label: "지남력·즉시기억", max: 13 },
  { key: "naming", label: "이름대기", max: 15 },
  { key: "cog_recall", label: "지연회상·재인", max: 6 },
  { key: "fluency", label: "유창성(동물)", max: 30 },
  { key: "digit", label: "숫자외우기", max: 13 },
  { key: "discourse", label: "담화", max: 10 },
  { key: "gds", label: "우울(역)", max: 15 },
  { key: "qol", label: "삶의질", max: 100 },
];
function Compare({ ids, sessions, onBack }) {
  const [sel, setSel] = useState(ids[0] || "");
  const mine = sessions.filter((s) => s.id === sel);
  const byTp = (tp) => mine.find((s) => s.timepoint === tp);
  const pre = byTp("pre"), mid = byTp("mid"), post = byTp("post");
  const val = (s, key) => (s && s.results[key] ? s.results[key].score : null);
  const pct = (s, m) => { const v = val(s, m.key); if (v === null) return 0; return m.key === "gds" ? Math.round((1 - v / m.max) * 100) : Math.round((v / m.max) * 100); };
  const chartData = METRICS.map((m) => ({ name: m.label, 사전: pre ? pct(pre, m) : 0, 사후: post ? pct(post, m) : 0 }));
  return (
    <Shell sub="사전·사후 비교">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-800">대상자별 변화</h2>
          <Btn kind="ghost" onClick={onBack}>← 처음으로</Btn>
        </div>
        {ids.length === 0 ? <p className="text-slate-500">저장된 평가가 없습니다.</p> : (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              {ids.map((id) => <Pill key={id} active={sel === id} onClick={() => setSel(id)}>{id}</Pill>)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="py-2">검사</th><th className="py-2 text-center">사전</th><th className="py-2 text-center">중간</th><th className="py-2 text-center">사후</th><th className="py-2 text-center">변화</th>
                </tr></thead>
                <tbody>
                  {METRICS.map((m) => {
                    const a = val(pre, m.key), b = val(post, m.key);
                    let chg = "-", col = "text-slate-400";
                    if (a !== null && b !== null) {
                      const better = m.key === "gds" ? b < a : b > a;
                      const same = a === b;
                      chg = (b - a > 0 ? "+" : "") + (b - a);
                      col = same ? "text-slate-400" : better ? "text-emerald-600 font-bold" : "text-rose-500 font-bold";
                    }
                    return (
                      <tr key={m.key} className="border-b border-slate-100">
                        <td className="py-2.5 font-medium text-slate-700">{m.label}</td>
                        <td className="py-2.5 text-center">{val(pre, m.key) ?? "-"}</td>
                        <td className="py-2.5 text-center">{val(mid, m.key) ?? "-"}</td>
                        <td className="py-2.5 text-center">{val(post, m.key) ?? "-"}</td>
                        <td className={`py-2.5 text-center ${col}`}>{chg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-2">* 우울(SGDS-K)은 점수가 낮을수록 좋음 → 감소가 호전.</p>
            <div className="mt-6" style={{ height: 280 }}>
              <p className="font-semibold text-slate-600 mb-2">사전 vs 사후 (최대 대비 %)</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="사전" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="사후" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>
    </Shell>
  );
}
