"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolveAffidiBackNav } from "@/lib/affidiNavBack";

export function AffidiIndietroLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname !== "/affidi") return null;

  const back = resolveAffidiBackNav(searchParams.toString());
  if (!back) return null;

  return (
    <nav aria-label="Indietro in Affidi">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--navy)] shadow-sm hover:bg-[#f8fafc]"
      >
        <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
        {back.label}
      </Link>
    </nav>
  );
}
