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

export function StrumentiNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 border-b border-[var(--line)]">
      <div className="flex flex-wrap gap-6">
        {STRUMENTI_MENU_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
                active
                  ? "border-[#00B0FF] text-[var(--navy)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--navy)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
