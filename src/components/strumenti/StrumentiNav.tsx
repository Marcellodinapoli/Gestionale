"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, Sparkles } from "lucide-react";
import { SectionTabNav, sectionTabClass } from "@/components/ui/SectionTabNav";

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

export function StrumentiNav() {
  const pathname = usePathname();

  return (
    <SectionTabNav label="Sezioni Strumenti AI">
      {STRUMENTI_MENU_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isStrumentiActive(pathname, href);
        return (
          <Link key={href} href={href} className={sectionTabClass(active)}>
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {label}
          </Link>
        );
      })}
    </SectionTabNav>
  );
}
