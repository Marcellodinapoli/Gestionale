import type { ReactNode } from "react";

/** Tab di sezione: stesso grafico del Dialer (bordo arancione, 1 cm dall’alto). */
export function sectionTabClass(active: boolean) {
  return `-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
    active
      ? "border-[#FB8C00] text-[var(--navy)]"
      : "border-transparent text-[var(--muted)] hover:text-[var(--navy)]"
  }`;
}

export function SectionTabNav({
  children,
  end,
  label,
  flush = false,
}: {
  children: ReactNode;
  end?: ReactNode;
  label?: string;
  /** Senza margine superiore (nav già dentro un’altra scheda). */
  flush?: boolean;
}) {
  return (
    <nav
      className={`${flush ? "" : "mt-[1cm]"} border-b border-[var(--line)]`}
      aria-label={label}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap gap-6">{children}</div>
        {end ?? null}
      </div>
    </nav>
  );
}
