"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function EmblemFull({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" aria-label="대림대학교 언어치료학과 엠블럼">
      <circle cx="250" cy="200" r="120" fill="none" stroke="currentColor" strokeWidth="9" />
      <line x1="218" y1="143" x2="218" y2="170" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="250" y1="135" x2="250" y2="165" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="282" y1="143" x2="282" y2="170" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="170" y1="190" x2="330" y2="190" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <polyline points="175,235 215,205 250,235 285,205 318,235" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <polygon points="320,228 333,225 326,237" fill="currentColor" />
      <line x1="218" y1="245" x2="218" y2="272" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="250" y1="252" x2="250" y2="282" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="282" y1="245" x2="282" y2="272" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <text x="250" y="395" textAnchor="middle" fontFamily="var(--font-noto-sans-kr), sans-serif" fontWeight="800" fontSize="48" fill="currentColor" letterSpacing="-1">대림대학교 언어치료학과</text>
    </svg>
  );
}

function EmblemMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="180" cy="180" r="160" fill="none" stroke="currentColor" strokeWidth="12" />
      <line x1="135" y1="100" x2="135" y2="140" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <line x1="180" y1="90" x2="180" y2="135" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <line x1="225" y1="100" x2="225" y2="140" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <line x1="80" y1="170" x2="280" y2="170" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <polyline points="85,235 140,195 185,235 230,195 275,235" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <polygon points="278,225 295,222 287,238" fill="currentColor" />
      <line x1="135" y1="250" x2="135" y2="290" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <line x1="180" y1="262" x2="180" y2="305" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <line x1="225" y1="250" x2="225" y2="290" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
}

type Module = { href: string; title: string; subtitle: string; description: string; color: "blue" | "emerald" | "amber" | "rose"; status: "ready" | "soon" };

const MODULES: Module[] = [
  { href: "/pitch", title: "실시간 피치·강도", subtitle: "F0 + dB Tracking", description: "기본주파수·음성강도·음역 시계열 통합 분석", color: "blue", status: "ready" },
  { href: "/vocal-tract", title: "모음·자음 시각화", subtitle: "Vocal Tract", description: "실시간 F1/F2 + 자음 조음 위치 + 마찰음 변별", color: "blue", status: "ready" },
  { href: "/voice-quality", title: "음질 분석", subtitle: "Voice Quality", description: "jitter · shimmer · HNR 자동 추출", color: "blue", status: "soon" },
  { href: "/mpt", title: "MPT", subtitle: "Maximum Phonation Time", description: "최대발성지속시간 · 3회 평균 자동 계산", color: "emerald", status: "soon" },
  { href: "/speech-rate", title: "말속도 분석", subtitle: "Speech Rate Suite", description: "녹음 한 번으로 전체속도 + 조음속도 + 쉬 구간 자동 분석", color: "amber", status: "soon" },
  { href: "/fluency", title: "유창성 분석", subtitle: "Fluency", description: "%SS 자동 계산 + 비유창 6종 실시간 태그", color: "amber", status: "soon" },
  { href: "/pace", title: "페이스 조절 훈련", subtitle: "Cued Pacing", description: "시각·청각·혼합 단서 훈련 · 세션 기록", color: "rose", status: "ready" },
  { href: "/daf", title: "DAF 훈련기", subtitle: "Delayed Auditory Feedback", description: "50–500ms 지연 청각피드백 (말더듬·파킨슨)", color: "rose", status: "soon" },
  { href: "/intensity-trainer", title: "강도 바이오피드백", subtitle: "Intensity Biofeedback", description: "목표 dB 구간 게이지 훈련 (LSVT LOUD 기반)", color: "rose", status: "soon" },
];

export default function HomePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let stored: string | null = null;
    try { stored = window.localStorage.getItem("voicelab-theme"); } catch {}
    const initial = (stored as "light" | "dark") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { window.localStorage.setItem("voicelab-theme", theme); } catch {}
  }, [theme, mounted]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const readyCount = MODULES.filter((m) => m.status === "ready").length;

  return (
    <div className="vl-wrap">
      <div className="vl-topbar">
        <Link className="vl-brand" href="/">
          <span className="vl-brand-mark"><EmblemMark /></span>
          <div className="vl-brand-text">
            <div className="kr">대림대학교 언어치료학과</div>
            <div className="en">Voice Lab · Speech &amp; Language Pathology</div>
          </div>
        </Link>
        <nav className="vl-nav">
          <a href="#" className="active">홈</a>
          <a href="#tools">도구</a>
          <a href="#about">소개</a>
          <a href="https://dept.daelim.ac.kr/slh/index.do" target="_blank" rel="noopener" data-keep>학과 홈페이지 ↗</a>
          <button className="vl-theme-toggle" type="button" onClick={toggleTheme} aria-label="테마 전환" title="테마 전환" data-keep>
            {mounted && theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
            )}
          </button>
        </nav>
      </div>
      <section className="vl-hero">
        <div>
          <div className="vl-eyebrow">DAELIM UNIVERSITY · DEPT. OF SPEECH &amp; LANGUAGE PATHOLOGY</div>
          <h1 className="vl-title">대림대학교<br /><span className="em">Voice</span> <span className="accent">Lab</span></h1>
          <p className="vl-lede">음성과 말 평가·치료를 위한 통합 허브. {MODULES.length}개 모듈에 필요한 분석을 모아둔 교육·임상·연구용 도구 모음입니다.</p>
          <div className="vl-meta-row">
            <div className="vl-meta"><b>{MODULES.length}</b> 모듈</div>
            <div className="vl-meta"><b>{readyCount}</b> 사용 가능</div>
            <div className="vl-meta"><b>{MODULES.length - readyCount}</b> 준비 중</div>
            <div className="vl-meta">버전 <b>v3.1</b></div>
          </div>
        </div>
        <div className="vl-crest-stage" aria-label="대림대학교 언어치료학과 엠블럼">
          <EmblemFull className="vl-crest" />
          <div className="vl-crest-divider"></div>
          <div className="vl-crest-cap">VOICE LAB · SPEECH &amp; LANGUAGE PATHOLOGY · <span className="yr">EST. 2025</span></div>
        </div>
      </section>
      <section id="tools">
        <div className="vl-section-head">
          <div>
            <h2>도구 모음</h2>
            <div className="sub">{MODULES.length}개 모듈 · 클릭하면 각 도구로 이동</div>
          </div>
          <span className="count">{readyCount} / {MODULES.length} ACTIVE</span>
        </div>
        <div className="vl-sub-grid">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className={`vl-sub-card vl-cat-${m.color}`}>
              <div className="vl-sub-top">
                <h3>{m.title}</h3>
                <span className={m.status === "ready" ? "vl-status vl-status-ready" : "vl-status vl-status-soon"}>{m.status === "ready" ? "사용 가능" : "준비 중"}</span>
              </div>
              <p className="vl-sub-subtitle">{m.subtitle}</p>
              <p className="vl-sub-desc">{m.description}</p>
              <span className="vl-sub-arrow">열기 →</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="vl-strip" id="about">
        <div className="cell"><div className="k">DEPARTMENT</div><div className="v">Speech &amp; Language<small>Pathology</small></div></div>
        <div className="cell"><div className="k">FOUNDED</div><div className="v">2025<small>Voice Lab</small></div></div>
        <div className="cell"><div className="k">FOCUS</div><div className="v">Voice · Speech</div></div>
        <div className="cell"><div className="k">CONTACT</div><div className="v">hbshin<small>@daelim.ac.kr</small></div></div>
      </section>
      <footer className="vl-foot-wrap">
        <div className="vl-foot-grid">
          <div className="vl-foot-col brand-col">
            <div className="vl-foot-brand">
              <span className="mark" aria-hidden="true"><EmblemMark /></span>
              <div className="name">대림대학교 언어치료학과<small>Dept. of Speech &amp; Language Pathology</small></div>
            </div>
            <p className="vl-foot-tag">전문성 있는 현장 맞춤형 <b style={{ color: "var(--ink-2)" }}>언어재활사(SLP)</b> 양성을 목표로 하는 학과. Voice Lab은 교육·임상·연구를 위한 보조 도구 허브.</p>
          </div>
          <div className="vl-foot-col vl-foot-contact">
            <h4>Contact</h4>
            <div className="row"><span className="k">주소</span><span>경기도 안양시 동안구 임곡로 29<br />대림대학교 홍지관 5층</span></div>
            <div className="row"><span className="k">TEL</span><span>031-467-4401</span></div>
            <div className="row"><span className="k">Email</span><span>hbshin@daelim.ac.kr</span></div>
          </div>
          <div className="vl-foot-col">
            <h4>학과 사이트</h4>
            <ul>
              <li><a href="https://dept.daelim.ac.kr/slh/index.do" target="_blank" rel="noopener">학과 공식 홈페이지 ↗</a></li>
              <li><a href="https://dept.daelim.ac.kr/slh/cms/FrCon/index.do?MENU_ID=270" target="_blank" rel="noopener">공지사항 ↗</a></li>
              <li><a href="https://dept.daelim.ac.kr/slh/cms/FrCon/index.do?MENU_ID=70" target="_blank" rel="noopener">언어치료센터 ↗</a></li>
              <li><a href="https://www.daelim.ac.kr/index.do" target="_blank" rel="noopener">대림대학교 ↗</a></li>
            </ul>
          </div>
          <div className="vl-foot-col">
            <h4>기타 도구</h4>
            <ul><li><Link href="/diagnosis" className="vl-foot-pd-link">PD Voice Diagnosis ↗</Link></li></ul>
            <h4 style={{ marginTop: 16 }}>Follow</h4>
            <div className="vl-foot-social">
              <a href="https://www.instagram.com/daelim_slp/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg></a>
              <a href="https://www.youtube.com/channel/UC2u7DC5wc2zXLLDPRGC37ww" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18 5 12 5 12 5s-6 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 9 2 12 2 12s0 3 .4 4.8c.2.9.9 1.6 1.8 1.8C6 19 12 19 12 19s6 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.8.4-4.8.4-4.8s0-3-.4-4.8zM10 15V9l5 3-5 3z" /></svg></a>
            </div>
          </div>
        </div>
        <div className="vl-foot-bottom">
          <span>© 2025 Daelim University · Department of Speech &amp; Language Pathology. All rights reserved.</span>
          <div className="links">
            <a href="https://www.daelim.ac.kr/cms/FrCon/index.do?MENU_ID=2410" target="_blank" rel="noopener">개인정보처리방침</a>
            <a href="https://dept.daelim.ac.kr/slh/index.do" target="_blank" rel="noopener">학과 홈페이지 ↗</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
