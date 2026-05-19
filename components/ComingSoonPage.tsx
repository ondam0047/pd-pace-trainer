import Link from "next/link";

export type CategoryColor = "blue" | "emerald" | "amber" | "rose";

const PALETTE: Record<
  CategoryColor,
  { border: string; bg: string; title: string; subtitle: string; tint: string }
> = {
  blue: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    title: "text-blue-900",
    subtitle: "text-blue-700",
    tint: "text-blue-600",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    title: "text-emerald-900",
    subtitle: "text-emerald-700",
    tint: "text-emerald-600",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    title: "text-amber-900",
    subtitle: "text-amber-700",
    tint: "text-amber-700",
  },
  rose: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    title: "text-rose-900",
    subtitle: "text-rose-700",
    tint: "text-rose-700",
  },
};

type Props = {
  category: string;
  title: string;
  subtitle: string;
  color: CategoryColor;
  description: string;
  features?: string[];
  references?: string[];
  notes?: string;
};

export default function ComingSoonPage({
  category,
  title,
  subtitle,
  color,
  description,
  features,
  references,
  notes,
}: Props) {
  const c = PALETTE[color];
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Voice Lab 허브로
        </Link>

        <div className={`rounded-2xl border ${c.border} ${c.bg} p-8 shadow-sm`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest ${c.tint}`}>
                {category}
              </p>
              <h1 className={`mt-2 text-3xl font-bold ${c.title}`}>{title}</h1>
              <p className={`mt-1 text-sm font-semibold ${c.subtitle}`}>{subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              준비 중
            </span>
          </div>

          <p className={`mt-6 leading-relaxed ${c.title}`}>{description}</p>

          {features && features.length > 0 && (
            <div className="mt-6">
              <h2 className={`text-sm font-bold ${c.subtitle}`}>예정 기능</h2>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
                {features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {references && references.length > 0 && (
            <div className="mt-5">
              <h2 className={`text-sm font-bold ${c.subtitle}`}>참고 / 근거</h2>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-slate-600">
                {references.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {notes && (
            <p className="mt-5 rounded-lg border border-slate-300 bg-white/60 px-4 py-3 text-sm text-slate-700">
              ⓘ {notes}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
