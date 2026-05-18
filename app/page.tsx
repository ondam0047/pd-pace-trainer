import Link from "next/link";

type ModuleStatus = "ready" | "preview" | "external";

type ModuleCard = {
  href: string;
  title: string;
  subtitle: string;
  description: string;
  accent: "blue" | "violet" | "emerald" | "amber";
  status: ModuleStatus;
};

const MODULES: ModuleCard[] = [
  {
    href: "/pitch",
    title: "실시간 음도 측정",
    subtitle: "Real-time Pitch Tracking",
    description:
      "마이크에 발성하는 동안 기본주파수(F0)가 시계열로 표시됩니다. 상·하한선을 드래그해 목표 음역대를 설정하고 머문 비율을 확인할 수 있습니다.",
    accent: "blue",
    status: "ready",
  },
  {
    href: "/vocal-tract",
    title: "성도 시각화",
    subtitle: "Vocal Tract Visualizer",
    description:
      "한국어 자음·모음 산출 시 혀와 성도의 움직임을 실시간으로 표시합니다. 조음 위치 학습과 정조음 유도에 사용하세요.",
    accent: "violet",
    status: "preview",
  },
  {
    href: "/pace",
    title: "PD Pace Trainer",
    subtitle: "말속도 조절 훈련",
    description:
      "파킨슨병 환자의 말속도 조절을 위한 시각·청각·혼합 단서 훈련 프로그램입니다. 세션 기록과 변화 추세를 함께 관리할 수 있습니다.",
    accent: "emerald",
    status: "ready",
  },
  {
    href: "/diagnosis",
    title: "PD Voice Diagnosis",
    subtitle: "파킨슨 하위 유형 분류",
    description:
      "음성 녹음과 음향 피처를 이용해 파킨슨 하위 유형을 분류합니다. 머신러닝 기반 임상 의사결정 지원 도구입니다.",
    accent: "amber",
    status: "external",
  },
];

const ACCENT_STYLES: Record<
  ModuleCard["accent"],
  { border: string; bg: string; title: string; subtitle: string; cta: string }
> = {
  blue: {
    border: "border-blue-200 hover:border-blue-400",
    bg: "bg-blue-50",
    title: "text-blue-900",
    subtitle: "text-blue-700",
    cta: "text-blue-700",
  },
  violet: {
    border: "border-violet-200 hover:border-violet-400",
    bg: "bg-violet-50",
    title: "text-violet-900",
    subtitle: "text-violet-700",
    cta: "text-violet-700",
  },
  emerald: {
    border: "border-emerald-200 hover:border-emerald-400",
    bg: "bg-emerald-50",
    title: "text-emerald-900",
    subtitle: "text-emerald-700",
    cta: "text-emerald-700",
  },
  amber: {
    border: "border-amber-200 hover:border-amber-400",
    bg: "bg-amber-50",
    title: "text-amber-900",
    subtitle: "text-amber-700",
    cta: "text-amber-700",
  },
};

const STATUS_BADGE: Record<ModuleStatus, { label: string; cls: string }> = {
  ready: { label: "사용 가능", cls: "bg-emerald-100 text-emerald-800" },
  preview: { label: "미리보기", cls: "bg-amber-100 text-amber-800" },
  external: { label: "준비 중", cls: "bg-slate-200 text-slate-800" },
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Daelim University · Department of Speech-Language Pathology
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            대림대학교 Voice Lab
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
            음성과 말 평가·치료를 위한 통합 허브입니다. 음도, 조음, 말속도,
            음향 진단까지 한 곳에서 교육·임상·연구에 활용하실 수 있도록
            설계되었습니다.
          </p>
        </header>

        <section>
          <h2 className="sr-only">모듈</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {MODULES.map((m) => {
              const accent = ACCENT_STYLES[m.accent];
              const badge = STATUS_BADGE[m.status];
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`group rounded-2xl border ${accent.border} ${accent.bg} p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-xl font-bold ${accent.title}`}>
                        {m.title}
                      </h3>
                      <p
                        className={`mt-1 text-sm font-medium ${accent.subtitle}`}
                      >
                        {m.subtitle}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">
                    {m.description}
                  </p>
                  <p
                    className={`mt-5 text-sm font-semibold ${accent.cta} group-hover:underline`}
                  >
                    열기 →
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500">
          <p>
            © Daelim University Voice Lab · 교육·임상·연구 목적으로 제작된
            통합 허브입니다.
          </p>
        </footer>
      </div>
    </main>
  );
}
