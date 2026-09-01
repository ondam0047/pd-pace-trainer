// 역이식된 로직 최소 점검. `npm run selfcheck` (node 22+ 타입 스트리핑 사용, 프레임워크 없음)
//   1) speechRate/analyzer  — 적응형 VAD 임계
//   2) fluency/transcriptTagger — 연장·막힘(DP) · 반복 횟수(count)
import assert from "node:assert/strict";
import { analyzeSpeechRate } from "../components/speechRate/analyzer.ts";
import { tagFromTranscript } from "../components/fluency/transcriptTagger.ts";

const SR = 16000;

/** 말–쉼–말 신호 생성. amp 로 전체 녹음 레벨을 조절한다. */
function makeSignal(amp: number): Float32Array {
  const sec = (n: number) => Math.round(SR * n);
  const out = new Float32Array(sec(3));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const speaking = t < 1.0 || t > 2.0; // 1.0~2.0s 는 쉼
    // 잡음바닥은 항상 있고, 발화 구간만 진폭이 커진다
    const noise = (Math.random() - 0.5) * 2 * amp * 0.02;
    out[i] = speaking ? Math.sin(2 * Math.PI * 150 * t) * amp + noise : noise;
  }
  return out;
}

// ── 1) 적응형 임계: 녹음이 작아도 쉼/발화가 갈려야 한다 ──────────────────
// amp=0.012 (RMS≈0.0085)는 고정 임계 0.012 시절 전 프레임이 '쉼'으로 잡혀
// speechDuration=0 → 조음속도 0 이 되던 구간이다. 적응형에서는 잡혀야 한다.
for (const amp of [0.5, 0.05, 0.012]) {
  const r = analyzeSpeechRate(makeSignal(amp), SR);
  assert.ok(
    r.speechDuration > 0.5,
    `amp=${amp}: 발화 구간을 못 찾음 (speechDuration=${r.speechDuration})`,
  );
  assert.ok(
    r.pauseCount >= 1,
    `amp=${amp}: 쉼을 못 찾음 (pauseCount=${r.pauseCount})`,
  );
}

// 명시적 임계를 주면 그대로 쓴다(하위호환) — 큰 값이면 전부 쉼으로 잡혀야 한다
{
  const r = analyzeSpeechRate(makeSignal(0.05), SR, { threshold: 0.9 });
  assert.equal(r.speechDuration, 0, "명시 threshold 가 무시됨");
}

// 알려진 한계(회귀가 아니라 사양): 적응형 임계에도 절대 하한 0.006 이 있어
// RMS 가 그보다 작은 극저레벨 녹음은 여전히 전부 '쉼'으로 잡힌다.
// ponytail: 잡음만 있는 트랙을 발화로 오인하지 않으려는 가드. 이보다 조용한
// 녹음까지 살리려면 하한 대신 SNR 판정이 필요하다 — 실제 민원이 생기면 그때.
{
  const r = analyzeSpeechRate(makeSignal(0.004), SR);
  assert.equal(r.speechDuration, 0, "하한 0.006 동작이 바뀜 — 사양 변경 여부 확인 필요");
}

// ── 2) transcriptTagger ────────────────────────────────────────────────
{
  const tags = tagFromTranscript("아ː아 #막혀서 지-지-지구", 9);
  const types = tags.map((t) => t.type);

  // 연장·막힘은 P-FA-II 에서 별도 코드가 아니라 비운율적 발성(DP)
  assert.equal(
    types.filter((t) => t === "DP").length,
    2,
    `연장·막힘이 DP 2건으로 안 잡힘: ${JSON.stringify(tags)}`,
  );

  // 음절 반복은 횟수까지
  const r2 = tags.find((t) => t.type === "R2");
  assert.ok(r2, "음절 반복(R2) 미탐지");
  assert.equal(r2.count, 3, `'지-지-지구' 반복 횟수 오산: ${r2.count}`);
}

{
  // 토큰 간 반복 런은 하나의 태그로 묶이고 횟수를 갖는다
  const tags = tagFromTranscript("어제 어제 어제 갔어요", 8);
  const r1 = tags.filter((t) => t.type === "R1");
  assert.equal(r1.length, 1, `반복 런이 ${r1.length}건으로 쪼개짐`);
  assert.equal(r1[0].count, 3, `낱말 반복 횟수 오산: ${r1[0].count}`);
}

{
  // 회귀: 기존 4종(I·UR·R1·R2)이 그대로 나와야 한다
  const tags = tagFromTranscript("음 하- 아니 만났-만났어요", 6);
  const types = new Set(tags.map((t) => t.type));
  for (const want of ["I", "UR", "R1"]) {
    assert.ok(types.has(want as never), `${want} 미탐지: ${JSON.stringify(tags)}`);
  }
}

// 빈 입력
assert.deepEqual(tagFromTranscript("   ", 5), []);

console.log("selfcheck OK");
