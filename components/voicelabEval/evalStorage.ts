/**
 * voicelab 평가 모듈 — 세션 저장소
 *
 * `saveSession` / `listSessions` 는 모듈 본체가 백엔드와 닿는 유일한 지점입니다.
 * 지금은 voicelab 허브 컨벤션( `voice-lab-history.ts` 와 동일하게 localStorage
 * 기반 )으로 동작하지만, 정식 운영 시 두 함수의 본문만 허브 API 호출(fetch)로
 * 바꾸면 됩니다. 모듈 UI 는 손대지 않아도 됩니다.
 *
 * 키 컨벤션: `voicelab:eval:{대상자ID}:{timepoint}`
 *   - timepoint: "pre" | "mid" | "post"
 *   - 한 대상자의 같은 시점 평가를 다시 저장하면 덮어씁니다 (재실시 시 의도된 동작).
 */

export type Timepoint = "pre" | "mid" | "post";

export interface EvalModuleResult {
  score: number;
  max: number;
  detail: Record<string, string | number>;
  flags?: string[];
  lowerBetter?: boolean;
}

export interface ConsentRecord {
  agreedAt: string; // ISO timestamp
  version: string;
  items: string[]; // 동의한 항목 키 목록
  signatureName: string; // 자필 서명 대용 (입력한 성함)
}

export interface EvalSession {
  id: string;
  name: string;
  age: string | number;
  edu: string | number;
  sex: string;
  timepoint: Timepoint;
  date: string; // YYYY-MM-DD
  results: Record<string, EvalModuleResult>;
  /** 평가 시작 전 받은 수집·이용 동의 기록 (없으면 미동의 — 정식 운영 시 동의 없으면 시작 불가). */
  consent?: ConsentRecord;
}

const PREFIX = "voicelab:eval:";
const INDEX_KEY = "voicelab:eval:__index__";
export const EVAL_UPDATED_EVENT = "voicelab-eval-updated";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readIndex(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(keys: string[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(Array.from(new Set(keys))));
}

function sessionKey(id: string, timepoint: Timepoint): string {
  return `${PREFIX}${id}:${timepoint}`;
}

/**
 * 세션 한 건을 저장한다. 백엔드 연동 시 이 함수 본문을
 *   await fetch('/api/voicelab/eval/sessions', { method: 'PUT', body: JSON.stringify(s) })
 * 같은 형태로 바꾸면 됨.
 */
export async function saveSession(s: EvalSession): Promise<boolean> {
  if (!isBrowser()) return false;
  if (!s.id || !s.timepoint) return false;
  try {
    const key = sessionKey(s.id, s.timepoint);
    window.localStorage.setItem(key, JSON.stringify(s));
    const idx = readIndex();
    if (!idx.includes(key)) {
      idx.push(key);
      writeIndex(idx);
    }
    window.dispatchEvent(new Event(EVAL_UPDATED_EVENT));
    return true;
  } catch (err) {
    console.error("voicelab eval 저장 실패", err);
    return false;
  }
}

/**
 * 저장된 모든 세션을 반환한다. 백엔드 연동 시 이 함수 본문을
 *   const res = await fetch('/api/voicelab/eval/sessions');
 *   return await res.json();
 * 같은 형태로 바꾸면 됨.
 */
export async function listSessions(): Promise<EvalSession[]> {
  if (!isBrowser()) return [];
  const out: EvalSession[] = [];
  const seenKeys = new Set<string>();

  // 1) 인덱스 기반 우선 조회
  for (const key of readIndex()) {
    seenKeys.add(key);
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      out.push(JSON.parse(raw) as EvalSession);
    } catch {
      // 손상된 항목은 건너뜀
    }
  }

  // 2) 인덱스 누락분 보호용 — PREFIX 로 시작하는 모든 키 스캔 (인덱스 키는 제외)
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith(PREFIX) || k === INDEX_KEY || seenKeys.has(k)) continue;
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      out.push(JSON.parse(raw) as EvalSession);
      seenKeys.add(k);
    } catch {
      // skip
    }
  }

  // 최신 날짜 먼저
  out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return out;
}

/** 특정 대상자/시점 세션 삭제 — 관리 UI 용. */
export async function deleteSession(id: string, timepoint: Timepoint): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const key = sessionKey(id, timepoint);
    window.localStorage.removeItem(key);
    writeIndex(readIndex().filter((k) => k !== key));
    window.dispatchEvent(new Event(EVAL_UPDATED_EVENT));
    return true;
  } catch (err) {
    console.error("voicelab eval 삭제 실패", err);
    return false;
  }
}
