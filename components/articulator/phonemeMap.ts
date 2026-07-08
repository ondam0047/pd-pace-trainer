// Korean phoneme → blendshape-weight mapping for the rigged articulator model.
// Source of truth: Downloads/articulator_3d_notes.md (§ 한국어 음소 → 블렌드셰이프 매핑).
// Morph names must match the GLB exactly (head/lip/tongue meshes, keyed by name).
//
// Weight semantics (notes §조음 원리):
//   1.0       = full contact (stops, nasals, lateral)
//   0.7~0.85  = constriction, not touching (fricatives → turbulence)
//   0~0.3     = near-neutral / open (vowels, ㅎ)

export type Pose = Record<string, number>;

// `velum_open` direction is baked into the GLB as of v16 (transplant.py): the
// rigger's inverted key (w=1 closed) was re-based so rest=closed and w=1 opens
// the velopharyngeal port. No runtime inversion needed anymore.
export const VELUM_INVERTED = false;

export type Manner =
  | "stop"
  | "nasal"
  | "fricative"
  | "affricate"
  | "tap"
  | "lateral"
  | "glottal";

export function mannerOf(s: string): Manner {
  if (s.includes("파찰")) return "affricate";
  if (s.includes("파열")) return "stop";
  if (s.includes("비음")) return "nasal";
  if (s.includes("마찰")) return "fricative";
  if (s.includes("탄설")) return "tap";
  if (s.includes("설측")) return "lateral";
  return "glottal";
}

// All controllable morph targets (for zeroing / iteration).
export const MORPHS = [
  "tongue_tip_up",
  "tongue_tip_down",
  "tongue_front_up",
  "tongue_back_up",
  "tongue_retract",
  "tongue_groove",
  "tongue_lateral_channel",
  "lips_closed",
  "lips_round",
  "lips_spread",
  "jaw_open",
  "velum_open",
] as const;

// Lip-material opacity per phoneme type (notes §입술 투명도 매핑). Lower = reveal
// tongue/contact behind the lips; 1.0 = lips are the key articulator.
export const LIP_OPACITY = {
  bilabial: 1.0, // ㅂㅍㅁ — lips are the articulator
  rounded: 1.0, // ㅗㅜ + 원순 이중모음 — rounding is the cue
  spread: 0.6, // ㅣㅔㅐ — show spread but expose tongue
  fricative: 0.25, // ㅅㅆㅈㅊ — groove/contact is the cue
  alveolar: 0.4, // ㄷㅌㄴ — tongue-tip contact
  velar: 0.4, // ㄱㅋㅇ — tongue-back contact
  lateral: 0.3, // ㄹ — lateral airflow
  glottal: 0.5, // ㅎ — cavity follows vowel
  openVowel: 0.6, // ㅏㅓㅡ — show inside
  idle: 1.0,
} as const;

export type Consonant = {
  id: string;
  label: string; // member graphemes (평/격/경 동일 그룹)
  manner: string;
  pose: Pose;
  opacity: number;
  repeat?: boolean; // ㄹ 탄설 — tap, oscillate
  note?: string;
};

// 자음 11그룹 (평음/격음/경음 동일 형태 — 성문 긴장도·VOT만 차이)
export const CONSONANTS: Consonant[] = [
  { id: "p", label: "ㅂㅍㅃ", manner: "양순 파열", pose: { lips_closed: 1 }, opacity: LIP_OPACITY.bilabial },
  { id: "m", label: "ㅁ", manner: "양순 비음", pose: { lips_closed: 1, velum_open: 1 }, opacity: LIP_OPACITY.bilabial },
  { id: "t", label: "ㄷㅌㄸ", manner: "치조 파열", pose: { tongue_tip_up: 1, jaw_open: 0.2 }, opacity: LIP_OPACITY.alveolar },
  { id: "n", label: "ㄴ", manner: "치조 비음", pose: { tongue_tip_up: 1, velum_open: 1 }, opacity: LIP_OPACITY.alveolar },
  {
    id: "s",
    label: "ㅅㅆ",
    manner: "치조 마찰",
    pose: { tongue_front_up: 0.85, tongue_tip_up: 0.45, tongue_groove: 0.5, jaw_open: 0.3 },
    opacity: LIP_OPACITY.fricative,
    note: "혀끝만 말리지 않고 혀 몸통(blade)이 위로 치조까지 — front_up 위주 + 약한 tip_up",
  },
  {
    id: "c",
    label: "ㅈㅊㅉ",
    manner: "치경경구개 파찰",
    pose: { tongue_front_up: 1, tongue_groove: 0.5 },
    opacity: LIP_OPACITY.fricative,
    note: "폐쇄→개방 2단계",
  },
  { id: "k", label: "ㄱㅋㄲ", manner: "연구개 파열", pose: { tongue_back_up: 0.8 }, opacity: LIP_OPACITY.velar },
  { id: "ng", label: "ㅇ(받침)", manner: "연구개 비음", pose: { tongue_back_up: 0.8, velum_open: 1 }, opacity: LIP_OPACITY.velar },
  { id: "r_tap", label: "ㄹ(탄설)", manner: "치조 탄설", pose: { tongue_tip_up: 1 }, opacity: LIP_OPACITY.lateral, repeat: true },
  // 설측: 탄설과 동일한 혀끝 치조 위치, 차이는 타이밍뿐(설측=유지 / 탄설=상승후 하강).
  // tongue_lateral_channel은 혀를 비인두까지 솟구치게 해 제외(모프 거동 의심 — 리거 확인 대상).
  { id: "l", label: "ㄹ(설측)", manner: "치조 설측", pose: { tongue_tip_up: 1 }, opacity: LIP_OPACITY.lateral },
  { id: "h", label: "ㅎ", manner: "성문 마찰", pose: { jaw_open: 0.3 }, opacity: LIP_OPACITY.glottal, note: "후속 모음에 동시조음" },
];

export type Vowel = {
  id: string;
  label: string;
  feature: string;
  pose: Pose;
  opacity: number;
};

// 단모음 8 (ㅚㅟ는 이중모음으로 처리)
export const VOWELS: Record<string, Vowel> = {
  // ㅏ [ɐ] 저·중앙 — 후설이 아니므로 tongue_retract 제거(개구가 핵심 단서)
  a: { id: "a", label: "ㅏ", feature: "저·중앙 평순", pose: { jaw_open: 0.85 }, opacity: LIP_OPACITY.openVowel },
  eo: { id: "eo", label: "ㅓ", feature: "중·후 평순", pose: { jaw_open: 0.5, tongue_retract: 0.2 }, opacity: LIP_OPACITY.openVowel },
  o: { id: "o", label: "ㅗ", feature: "중·후 원순", pose: { jaw_open: 0.3, lips_round: 0.7, tongue_back_up: 0.4 }, opacity: LIP_OPACITY.rounded },
  u: { id: "u", label: "ㅜ", feature: "고·후 원순", pose: { lips_round: 1, tongue_back_up: 0.6 }, opacity: LIP_OPACITY.rounded },
  eu: { id: "eu", label: "ㅡ", feature: "고·후 평순", pose: { tongue_back_up: 0.5 }, opacity: LIP_OPACITY.openVowel },
  i: { id: "i", label: "ㅣ", feature: "고·전 평순", pose: { tongue_front_up: 0.8, lips_spread: 0.6 }, opacity: LIP_OPACITY.spread },
  // 현대 서울말에서 ㅔ/ㅐ는 [e̞]로 병합 → 동일 자세 (이중모음 ㅖ=ㅒ, ㅞ=ㅙ도 자동 일치)
  e: { id: "e", label: "ㅔ", feature: "중·전 평순 [e̞] (ㅔ/ㅐ 병합)", pose: { tongue_front_up: 0.35, lips_spread: 0.3, jaw_open: 0.35 }, opacity: LIP_OPACITY.spread },
  ae: { id: "ae", label: "ㅐ", feature: "중·전 평순 [e̞] (ㅔ/ㅐ 병합)", pose: { tongue_front_up: 0.35, lips_spread: 0.3, jaw_open: 0.35 }, opacity: LIP_OPACITY.spread },
};

export type Diphthong = {
  id: string;
  label: string;
  from: string; // vowel id
  to: string; // vowel id
};

// 이중모음 — 단모음간 시간축 보간. ㅐ/ㅔ 병합([e̞])으로 ㅖ=ㅒ, ㅞ=ㅙ=ㅚ가
// 동일 발음이라 통합 버튼으로 묶음.
export const DIPHTHONGS: Diphthong[] = [
  { id: "ya", label: "ㅑ", from: "i", to: "a" },
  { id: "yeo", label: "ㅕ", from: "i", to: "eo" },
  { id: "yo", label: "ㅛ", from: "i", to: "o" },
  { id: "yu", label: "ㅠ", from: "i", to: "u" },
  { id: "ye", label: "ㅖ/ㅒ", from: "i", to: "e" }, // ㅖ=ㅒ
  { id: "wa", label: "ㅘ", from: "u", to: "a" },
  { id: "wo", label: "ㅝ", from: "u", to: "eo" },
  { id: "we", label: "ㅞ/ㅙ/ㅚ", from: "u", to: "e" }, // ㅞ=ㅙ=ㅚ
  { id: "wi", label: "ㅟ", from: "u", to: "i" },
  { id: "ui", label: "ㅢ", from: "eu", to: "i" },
];

// Build a full 12-morph pose (missing targets → 0) from a sparse pose.
export function fullPose(p: Pose): Pose {
  const out: Pose = {};
  for (const m of MORPHS) out[m] = p[m] ?? 0;
  return out;
}

// Rest/idle: velopharyngeal port OPEN (nasal breathing). Oral sounds actively
// close it (velum_open = 0); nasals keep it open. Since v16 the shape key drives
// the port directly (w=1 = open) — no apply-time inversion.
export const IDLE_POSE: Pose = fullPose({ velum_open: 1 });

// Linear interpolation between two poses (used for diphthongs & smoothing).
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const m of MORPHS) {
    const av = a[m] ?? 0;
    const bv = b[m] ?? 0;
    out[m] = av + (bv - av) * t;
  }
  return out;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
