import type { ReactNode } from "react";
import { STATO_LABELS } from "@/lib/permissions";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatoBadge({ stato }: { stato: string }) {
  const colors: Record<string, string> = {
    NUOVA: "bg-slate-100 text-slate-700",
    AFFIDATA: "bg-sky-100 text-sky-800",
    IN_LAVORAZIONE: "bg-amber-100 text-amber-800",
    PROMESSA: "bg-violet-100 text-violet-800",
    PIANO: "bg-indigo-100 text-indigo-800",
    INCASSO: "bg-emerald-100 text-emerald-800",
    INESIGIBILE: "bg-rose-100 text-rose-800",
    RESA: "bg-stone-200 text-stone-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${colors[stato] || "bg-slate-100"}`}
    >
      {STATO_LABELS[stato] || stato}
    </span>
  );
}

export function Card({
  title,
  children,
  id,
}: {
  title?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="min-w-0 rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm"
    >
      {title ? (
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {title}
        </h2>
      ) : null}
      <div className="min-w-0 table-scroll">{children}</div>
    </section>
  );
}
