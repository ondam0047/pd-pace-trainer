# WHOQOL-BREF — WHO Licence Record

본 폴더의 평가 모듈에서 사용하는 **WHO Quality of Life — BREF (WHOQOL-BREF)**
한국어판 26문항은 WHO 의 명시적 허가에 따라 본 제품에 포함되어 있습니다.

## 허가 메타

- **WHO Licence Request ID**: `202609140`
- **권리자**: World Health Organization (WHO), Geneva
- **허가 범위**: Non-exclusive, worldwide, royalty-free, non-transferable licence
  to reproduce/translate the Licensed Materials within this Product (per WHO
  Permissions agreement).
- **수령자**: Dr Shin / 대림대학교 언어치료학과 (voicelab 평가 모듈)

## 의무 표기 (WHO Permissions Agreement §4)

화면(`ModQOL`) 상단·결과 보고서·코드 주석에 다음 문구를 표기:

> Translated into Korean from **WHOQOL-BREF**, Geneva, World Health Organization
> (WHO), 1996 (https://www.who.int/tools/whoqol/whoqol-bref, accessed 2025/2026).
> WHO is not responsible for the content or accuracy of this translation/adaptation.
> In the event of any inconsistency between the English and the Korean translation,
> the original English version shall be the binding and authentic version.
> WHO does not endorse any specific companies, products or services.

원문(PDF) 자체 안내문도 동일 취지:

> This translation was not created by the World Health Organization (WHO). WHO
> is not responsible for the content or accuracy of this translation. In the
> event of any inconsistency between the English and the translated version,
> the original English version shall be the binding and authentic version.

## 준수 규칙 (요약)

- **§6 — 무단 변경 금지**: 26문항·5점 척도 라벨·역문항을 임의로 줄이거나
  바꾸지 말 것. 포맷·스타일 미세 조정만 허용. 새 문항 추가도 사전 동의 필요.
- **§7 — 상업·마케팅 사용 금지**: 본 제품의 교육/임상/연구 맥락 내 사용만 허용.
- **§8 — WHO 추천 인상 금지**: "WHO 가 본 제품을 인증/추천한다" 같은 표현
  사용 금지.
- **§9 — WHO 로고·엠블럼 사용 금지**.
- **§3 — 번역본 PDF 제공 의무**: 차후 자체 재번역 진행 시 PDF 를 WHO 에 송부.
  (현재는 WHO 사이트의 1996 field trial 한국어판을 그대로 사용 — 자체 번역 아님.)
- **§5 — 업데이트**: who.int 에서 최신본 갱신 시 새 라이선스 필요.

## 채점 (WHO syntax 기준)

- 26문항 모두 1–5 점수. 역문항(`r:true`)은 점수 변환: `new = 6 - old`.
- 영역점수(0–100): `mean × 4 → ((raw - 4) / 16) × 100`.
- 영역 배정 (WHO syntax):
  - **신체(Physical)** — items 3, 4, 10, 15, 16, 17, 18
  - **심리(Psychological)** — items 5, 6, 7, 11, 19, 26
  - **사회(Social)** — items 20, 21, 22
  - **환경(Environment)** — items 8, 9, 12, 13, 14, 23, 24, 25
  - 전반(Overall) — items 1, 2 (별도 보고, 영역점수 합산 제외)

## 파기 / 종료 시

- 라이선스 종료 또는 사업 종료 시 90일 내 추가 배포 중단 (§12). 기존 사용자에게는
  지속 사용 허용. 사용 종료 후 본 파일은 기록용으로 보관.

## 후속 작업

- [ ] who.int 의 한국어판 PDF 다운로드 일자를 위 의무 표기에 정확히 기재
- [ ] WHO 가 한국어 공식 (1996 field trial 이후) 갱신본을 내면 §5 에 따라 새 허가 신청
- [ ] 자체 재번역하게 되면 §3 따라 번역 PDF 를 WHO 에 송부
