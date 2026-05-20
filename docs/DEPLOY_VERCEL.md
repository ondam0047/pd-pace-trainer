# Vercel 배포 가이드 — 대림대학교 Voice Lab

## 한 번만 수행하는 초기 배포 (약 3분)

1. **Vercel 가입 / 로그인**
   - https://vercel.com → "Continue with GitHub"
   - GitHub 계정 `ondam0047` 로 로그인 (또는 학과 공용 계정)

2. **저장소 임포트**
   - 대시보드 우상단 **"Add New… → Project"**
   - "Import Git Repository" 목록에서 `ondam0047/pd-pace-trainer` 선택
   - 만약 안 보이면 "Adjust GitHub App Permissions" 로 해당 repo 권한 허용

3. **설정 확인 (대부분 자동)**
   - **Framework Preset**: `Next.js` (자동 감지)
   - **Root Directory**: `./` (기본)
   - **Build Command**: `next build` (자동)
   - **Output Directory**: `.next` (자동)
   - **Install Command**: `npm install` (자동)
   - **Node.js Version**: 22.x (기본 OK)
   - **Branch to Deploy**: 처음에는 `claude/voice-lab-hub-PIvNn` 선택 (또는 main 으로 PR/merge 후)

4. **Environment Variables**
   - 비워두면 됩니다. 이 프로젝트는 백엔드·API 키 없이 브라우저 안에서만 동작합니다.

5. **Deploy 클릭** → 약 1–2분 후 `https://pd-pace-trainer-<hash>.vercel.app` URL 생성.

---

## 이후 배포 (자동)

위 브랜치에 push 하면 Vercel 이 자동으로 새 배포를 만들고 URL 알림:

- Production 브랜치 (main / 위에서 고른 브랜치) → 영구 도메인 갱신
- 그 외 브랜치 / PR → Preview 도메인 생성 (검토용)

---

## 커스텀 도메인 연결 (선택)

학과 공식 도메인을 쓰고 싶을 때:

1. Vercel Project → **Settings → Domains** → Add `voicelab.daelim.ac.kr`
2. Vercel 이 안내하는 DNS 레코드 (CNAME 1개) 를 학과 전산팀에 요청해 등록
3. 발급된 LetsEncrypt 인증서 자동 갱신

---

## 비용 / 한도

**Hobby (무료) 플랜**으로 충분합니다.
- 월 100GB 대역폭
- 사용자 동시 100명 정도까지 무리 없음
- 학과·연구·교육용은 Vercel 정책상 무료 허용 (상업/SaaS 만 Pro 필요)

모니터링:
- Project → Analytics 탭에서 PV / 응답 시간 / 지역 분포 확인 가능 (Pro 이상 자세히)

---

## 본 저장소에 포함된 설정 (`vercel.json`)

```json
{
  "framework": "nextjs",
  "regions": ["icn1"],  // 한국 (서울) 리전 강제 — 한국 사용자 응답 시간 최적
  "headers": [...]      // 보안 헤더 + Permissions-Policy 로 마이크만 허용
}
```

---

## 문제 해결

| 증상 | 원인 / 해결 |
|------|-------------|
| 빌드 실패 "Cannot find module @next/swc-linux-x64-gnu" | Node 버전 18 이하 — Vercel 설정에서 Node 20+ 선택 |
| 마이크 권한 거부 | 브라우저 주소창의 자물쇠 아이콘 → "마이크 허용". `vercel.json` 의 Permissions-Policy 가 `self` 로 설정돼 사이트 자체는 허용됨 |
| 한글 폰트 깨짐 | next/font 로 Noto Sans KR 로드 중 — Vercel 빌드는 인터넷 접속 OK 라 문제 없음 |
| 빌드 시간 길어짐 | 처음 빌드만 ~2분, 이후는 캐시로 30초대 |

---

## PD Voice Diagnosis 모듈 (별도)

`pd-voice-diagnosis` 저장소는 Python/Streamlit 기반이라 Vercel 에 안 올라갑니다.
별도 배포는 `pd-voice-diagnosis/docs/DEPLOY_AWS.md` 참고 (AWS EC2 t4g.small).
