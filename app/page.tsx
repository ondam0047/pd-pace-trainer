"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function EmblemFull({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="대림대학교 언어치료학과 엠블럼"
    >
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
      <text x="250" y="395" textAnchor="middle" fontFamily="var(--font-noto-sans-kr), sans-serif" fontWeight="800" fontSize="48" fill="currentColor" letterSpacing="-1">
        대림대학교 언어치료학과
      </text>
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

type Status = "ready" | "soon";
type Color = "blue" | "emerald" | "amber" | "rose";

type SubModule = {
  href: string;
  title: string;
  subtitle: string;
  status: Status;
};

type Category = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  color: Color;
  modules: SubModule[];
};

const CATEGORIES: Category[] = [
  {
    id: "acoustic",
    icon: "🔵",
    title: "음향 분석",
    subtitle: "Acoustic Analysis",
    color: "blue",
    modules: [
      { href: "/acoustic/pitch", title: "실시간 피치 분석", subtitle: "Pitch Tracking (F0)", status: "ready" },
      { href: "/acoustic/vocal-tract", title: "모음·자음 시각화", subtitle: "Vocal Tract · F1/F2 · Sibilant", status: "ready" },
      { href: "/acoustic/voice-quality", title: "음질 분석", subtitle: "Jitter · Shimmer · HNR", status: "soon" },
      { href: "/acoustic/intensity", title: "음성강도 측정", subtitle: "Intensity (dB)", status: "soon" },
    ],
  },
  {
    id: "aerodynamic",
    icon: "🟢",
    title: "공기역학 분석",
    subtitle: "Aerodynamic Analysis",
    color: "emerald",
    modules: [
      { href: "/aerodynamic/mpt", title: "최대발성지속시간", subtitle: "MPT", status: "soon" },
      { href: "/aerodynamic/emfr", title: "추정 평균호기류율", subtitle: "EMFR = VC ÷ MPT", status: "soon" },
      { href: "/aerodynamic/breathing", title: "흡기 수 추정", subtitle: "Breath Group Count", status: "soon" },
    ],
  },
  {
    id: "flow",
    icon: "🟡",
    title: "말 흐름 분석",
    subtitle: "Speech Rate & Fluency",
    color: "amber",
    modules: [
      { href: "/flow/speaking-rate", title: "전체말속도", subtitle: "Overall Speaking Rate", status: "soon" },
      { href: "/flow/articulation-rate", title: "조음속도", subtitle: "Articulation Rate (250ms 제외)", status: "soon" },
      { href: "/flow/pause", title: "쉬 구간 분석", subtitle: "Pause Analysis", status: "soon" },
      { href: "/flow/fluency", title: "유창성 분석", subtitle: "%SS · 비유창 태그", status: "soon" },
    ],
  },
  {
    id: "intervention",
    icon: "🔴",
    title: "중재 프로그램",
    subtitle: "Intervention",
    color: "rose",
    modules: [
      { href: "/intervention/pace-trainer", title: "페이스 조절 훈련", subtitle: "Cued Pacing (시각·청각·혼합)", status: "ready" },
      { href: "/intervention/daf", title: "DAF 훈련기", subtitle: "Delayed Auditory Feedback", status: "soon" },
      { href: "/intervention/intensity-trainer", title: "강도 바이오피드백", subtitle: "Intensity Biofeedback", status: "soon" },
    ],
  },
];

export default function HomePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("voicelab-theme");
    } catch {}
    const initial =
      (stored as "light" | "dark") ||
      (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      window.localStorage.setItem("voicelab-theme", theme);
    } catch {}
  }, [theme, mounted]);

  const toggleTheme = () =>
    setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="vl-wrap">
      <div className="vl-topbar">
        <Link className="vl-brand" href="/">
          <span className="vl-brand-mark">
            <EmblemMark />
          </span>
          <div className="vl-brand-text">
            <div className="kr">대림대학교 언어치료학과</div>
            <div className="en">Voice Lab · Speech &amp; Language Pathology</div>
          </div>
        </Link>
        <nav className="vl-nav">
          <a href="#" className="active">홈</a>
          <a href="#acoustic">음향</a>
          <a href="#aerodynamic">공기역학</a>
          <a href="#flow">말 흐름</a>
          <a href="#intervention">중재</a>
          <a
            href="https://dept.daelim.ac.kr/slh/index.do"
            target="_blank"
            rel="noopener"
            data-keep
          >
            학과 홈페이지 ↗
          </a>
          <button
            className="vl-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label="테마 전환"
            title="테마 전환"
            data-keep
          >
            {mounted && theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>
        </nav>
      </div>

      <section className="vl-hero">
        <div>
          <div className="vl-eyebrow">
            DAELIM UNIVERSITY · DEPT. OF SPEECH &amp; LANGUAGE PATHOLOGY
          </div>
          <h1 className="vl-title">
            대림대학교<br />
            <span className="em">Voice</span> <span className="accent">Lab</span>
          </h1>
          <p className="vl-lede">
            음성과 말 평가·치료를 위한 통합 허브입니다. 음향 분석 · 공기역학
            분석 · 말 흐름 분석 · 중재 프로그램의 4 대분류로 구성되어 교육·
            임상·연구에 활용하실 수 있도록 설계되었습니다.
          </p>
          <div className="vl-meta-row">
            <div className="vl-meta"><b>4</b> 대분류</div>
            <div className="vl-meta"><b>14</b> 모듈</div>
            <div className="vl-meta"><b>3</b> 사용 가능</div>
            <div className="vl-meta">버전 <b>v3.0</b></div>
          </div>
        </div>

        <div className="vl-crest-stage" aria-label="대림대학교 언어치료학과 엠블럼">
          <EmblemFull className="vl-crest" />
          <div className="vl-crest-divider"></div>
          <div className="vl-crest-cap">
            VOICE LAB · SPEECH &amp; LANGUAGE PATHOLOGY ·{" "}
            <span className="yr">EST. 2025</span>
          </div>
        </div>
      </section>

      {CATEGORIES.map((cat) => (
        <section key={cat.id} className="vl-category" id={cat.id}>
          <div className="vl-category-head">
            <span className="vl-category-icon" aria-hidden="true">
              {cat.icon}
            </span>
            <div>
              <h2>{cat.title}</h2>
              <p>{cat.subtitle}</p>
            </div>
            <span className={`vl-category-count vl-cat-${cat.color}`}>
              {cat.modules.filter((m) => m.status === "ready").length} / {cat.modules.length} ACTIVE
            </span>
          </div>
          <div className="vl-sub-grid">
            {cat.modules.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className={`vl-sub-card vl-cat-${cat.color}`}
              >
                <div className="vl-sub-top">
                  <h3>{m.title}</h3>
                  <span
                    className={
                      m.status === "ready"
                        ? "vl-status vl-status-ready"
                        : "vl-status vl-status-soon"
                    }
                  >
                    {m.status === "ready" ? "사용 가능" : "준비 중"}
                  </span>
                </div>
                <p className="vl-sub-subtitle">{m.subtitle}</p>
                <span className="vl-sub-arrow">열기 →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="vl-strip" id="about">
        <div className="cell">
          <div className="k">DEPARTMENT</div>
          <div className="v">Speech &amp; Language<small>Pathology</small></div>
        </div>
        <div className="cell">
          <div className="k">FOUNDED</div>
          <div className="v">2025<small>Voice Lab</small></div>
        </div>
        <div className="cell">
          <div className="k">FOCUS</div>
          <div className="v">Voice · Speech</div>
        </div>
        <div className="cell">
          <div className="k">CONTACT</div>
          <div className="v">hbshin<small>@daelim.ac.kr</small></div>
        </div>
      </section>

      <footer className="vl-foot-wrap">
        <div className="vl-foot-grid">
          <div className="vl-foot-col brand-col">
            <div className="vl-foot-brand">
              <span className="mark" aria-hidden="true">
                <EmblemMark />
              </span>
              <div className="name">
                대림대학교 언어치료학과
                <small>Dept. of Speech &amp; Language Pathology</small>
              </div>
            </div>
            <p className="vl-foot-tag">
              전문성 있는 현장 맞춤형{" "}
              <b style={{ color: "var(--ink-2)" }}>언어재활사(SLP)</b>{" "}
              양성을 목표로 하는 학과입니다. Voice Lab은 교육·임상·연구를
              위한 보조 도구 허브로 운영됩니다.
            </p>
          </div>

          <div className="vl-foot-col vl-foot-contact">
            <h4>Contact</h4>
            <div className="row"><span className="k">주소</span><span>경기도 안양시 동안구 임곡로 29<br />대림대학교 홍지관 5층</span></div>
            <div className="row"><span className="k">TEL</span><span>031-467-4401</span></div>
            <div className="row"><span className="k">FAX</span><span>031-467-4403</span></div>
            <div className="row"><span className="k">Email</span><span>hbshin@daelim.ac.kr</span></div>
          </div>

          <div className="vl-foot-col">
            <h4>학과 사이트</h4>
            <ul>
              <li><a href="https://dept.daelim.ac.kr/slh/index.do" target="_blank" rel="noopener">학과 공식 홈페이지 ↗</a></li>
              <li><a href="https://dept.daelim.ac.kr/slh/cms/FrCon/index.do?MENU_ID=170" target="_blank" rel="noopener">교육과정표 ↗</a></li>
              <li><a href="https://dept.daelim.ac.kr/slh/cms/FrCon/index.do?MENU_ID=270" target="_blank" rel="noopener">공지사항 ↗</a></li>
              <li><a href="https://dept.daelim.ac.kr/slh/cms/FrCon/index.do?MENU_ID=70" target="_blank" rel="noopener">언어치료센터 ↗</a></li>
              <li><a href="https://www.daelim.ac.kr/index.do" target="_blank" rel="noopener">대림대학교 ↗</a></li>
            </ul>
          </div>

          <div className="vl-foot-col">
            <h4>기타 도구</h4>
            <ul>
              <li>
                <Link href="/diagnosis" className="vl-foot-pd-link">
                  PD Voice Diagnosis ↗
                </Link>
              </li>
            </ul>
            <h4 style={{ marginTop: 16 }}>Follow</h4>
            <div className="vl-foot-social">
              <a href="https://www.instagram.com/daelim_slp/" target="_blank" rel="noopener" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="https://www.facebook.com/daelimslp/" target="_blank" rel="noopener" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.4V14h2.7v8h3.4z" /></svg>
              </a>
              <a href="https://www.youtube.com/channel/UC2u7DC5wc2zXLLDPRGC37ww" target="_blank" rel="noopener" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18 5 12 5 12 5s-6 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 9 2 12 2 12s0 3 .4 4.8c.2.9.9 1.6 1.8 1.8C6 19 12 19 12 19s6 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.8.4-4.8.4-4.8s0-3-.4-4.8zM10 15V9l5 3-5 3z" /></svg>
              </a>
              <a href="http://pf.kakao.com/_BxawLxj" target="_blank" rel="noopener" aria-label="KakaoTalk">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4C7 4 3 7.2 3 11.2c0 2.5 1.6 4.6 4 5.9-.2.6-.6 2.2-.7 2.6 0 .2.1.3.3.2.3-.1 2.3-1.5 3.1-2.1.7.1 1.4.2 2.3.2 5 0 9-3.2 9-7.2S17 4 12 4z" /></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="vl-foot-bottom">
          <span>© 2025 Daelim University · Department of Speech &amp; Language Pathology. All rights reserved.</span>
          <div className="links">
            <a href="https://www.daelim.ac.kr/cms/FrCon/index.do?MENU_ID=2410" target="_blank" rel="noopener">개인정보처리방침</a>
            <a href="https://www.daelim.ac.kr/cms/FrCon/index.do?MENU_ID=2480" target="_blank" rel="noopener">이메일무단수집거부</a>
            <a href="https://dept.daelim.ac.kr/slh/index.do" target="_blank" rel="noopener">학과 홈페이지 ↗</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
