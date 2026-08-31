import type { LucideIcon } from "lucide-react";
import type { ReactNode, RefObject } from "react";

export function StrumentiPageCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-md">
      {children}
    </div>
  );
}

export function StrumentiCardHeader({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-[var(--line)]">
      <div className="flex items-center gap-2.5 bg-[#e8eef4] px-4 py-3 sm:px-6">
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 text-[#FB8C00]" aria-hidden />
        ) : null}
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--navy)]">{title}</h2>
      </div>
      {children ? (
        <div className="space-y-2 border-t border-[var(--line)] bg-white px-4 py-4 sm:px-6">
          {children}
        </div>
      ) : null}
    </header>
  );
}

export function StrumentiPanelCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-[var(--line)] bg-[#e8eef4] px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--navy)]">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StrumentiChatArea({
  children,
  scrollRef,
}: {
  children: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] px-4 py-4 sm:px-6"
    >
      {children}
    </div>
  );
}

export function StrumentiComposeBar({
  label = "Scrivi la tua domanda",
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="shrink-0 border-t-2 border-[var(--navy)]/15 bg-[#eef4f8] px-4 py-4 sm:px-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--navy)]">{label}</p>
        {hint ? <p className="text-[11px] text-[var(--muted)]">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export const strumentiTextareaCls =
  "min-h-[44px] flex-1 resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--navy)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/15";

export const strumentiSendBtnCls =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--navy)] text-white transition hover:bg-[var(--navy-2)] disabled:opacity-50";
