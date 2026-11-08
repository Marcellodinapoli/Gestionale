import type { ReactNode } from "react";
import Link from "next/link";

export const dashboardKpiBase =
  "group flex h-full flex-col rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm transition hover:border-[#c5cdd8] hover:shadow";

export type DashboardKpiAccent = "accent" | "amber" | "slate";

export function dashboardKpiAccentClass(accent?: DashboardKpiAccent): string {
  if (accent === "amber") return "border-l-[3px] border-l-amber-500";
  if (accent === "slate") return "border-l-[3px] border-l-slate-400";
  if (accent === "accent") return "border-l-[3px] border-l-[var(--accent)]";
  return "";
}

export function DashboardKpi({
  title,
  value,
  hint,
  href,
  accentBar,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  /** Bordo sinistro come le altre card home (es. In lavorazione). */
  accentBar?: DashboardKpiAccent;
}) {
  const accent = accentBar ?? (href ? "accent" : undefined);
  const surface = `${dashboardKpiBase} ${dashboardKpiAccentClass(accent)}`.trim();
  const body = (
    <>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-0.5 tabular-nums text-2xl font-bold leading-tight text-[var(--navy)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{hint}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={surface}>
        {body}
      </Link>
    );
  }

  return <section className={surface}>{body}</section>;
}

const STATO_ACCENT: Record<string, string> = {
  NUOVA: "border-l-slate-400",
  AFFIDATA: "border-l-sky-500",
  IN_LAVORAZIONE: "border-l-amber-500",
  PROMESSA: "border-l-violet-500",
  PIANO: "border-l-indigo-500",
  INCASSO: "border-l-emerald-500",
  INESIGIBILE: "border-l-rose-500",
  RESA: "border-l-stone-500",
};

export function DashboardStato({
  label,
  count,
  stato,
  href,
}: {
  label: string;
  count: number;
  stato: string;
  href: string;
}) {
  const accent = STATO_ACCENT[stato] || "border-l-slate-400";

  return (
    <Link
      href={href}
      className={`${dashboardKpiBase} border-l-[3px] ${accent} hover:bg-[#fafbfc]`}
    >
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-0.5 tabular-nums text-xl font-bold text-[var(--navy)]">{count}</p>
    </Link>
  );
}
