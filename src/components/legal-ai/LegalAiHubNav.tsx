"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Download,
  FilePlus2,
  FileText,
  Home,
  PenLine,
  Scale,
  Sparkles,
} from "lucide-react";
import { SectionTabNav, sectionTabClass } from "@/components/ui/SectionTabNav";
import {
  LEGAL_AI_SECTIONS,
  resolveLegalAiSectionFromPath,
  type LegalAiSectionId,
} from "@/lib/legal-ai/sections";

const ICONS: Record<LegalAiSectionId, typeof Home> = {
  home: Home,
  nuovoAtto: FilePlus2,
  redazione: FileText,
  ricerca: Scale,
  revisione: PenLine,
  esportazione: Download,
};

export function LegalAiHubNav() {
  const pathname = usePathname();
  const active = resolveLegalAiSectionFromPath(pathname);

  return (
    <SectionTabNav
      label="Sezioni Credixa Legal AI"
      end={
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 ring-1 ring-violet-200">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Modulo Legal AI
        </span>
      }
    >
      {LEGAL_AI_SECTIONS.map((section) => {
        const on = section.id === active;
        const Icon = ICONS[section.id];
        if (on) {
          return (
            <span
              key={section.id}
              className={sectionTabClass(true)}
              aria-current="page"
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {section.label}
            </span>
          );
        }
        return (
          <Link key={section.id} href={section.href} className={sectionTabClass(false)}>
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {section.label}
          </Link>
        );
      })}
    </SectionTabNav>
  );
}
