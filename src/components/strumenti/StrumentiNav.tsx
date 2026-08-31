"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, Sparkles } from "lucide-react";

export const STRUMENTI_MENU_ITEMS = [
  {
    href: "/strumenti/ricerca-normativa",
    label: "Ricerca normativa",
    icon: Scale,
  },
  {
    href: "/strumenti/analisi-pre-contatto",
    label: "Analisi Strategica Pre-Contatto",
    icon: Sparkles,
  },
] as const;

function isStrumentiActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Stesso stile tab di FormazioneNav (bordo arancione attivo). */
const tabLinkCls = (active: boolean) =>
  `-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
    active
      ? "border-[#FB8C00] text-[var(--navy)]"
      : "border-transparent text-[var(--muted)] hover:text-[var(--navy)]"
  }`;

export function StrumentiNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 border-b border-[var(--line)]">
      <div className="flex flex-wrap items-end gap-6">
        {STRUMENTI_MENU_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isStrumentiActive(pathname, href);
          return (
            <Link key={href} href={href} className={tabLinkCls(active)}>
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
