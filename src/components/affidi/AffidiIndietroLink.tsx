"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolveAffidiBackNav } from "@/lib/affidiNavBack";
import { navigateBack } from "@/lib/navBack";

export function AffidiIndietroLink() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pathname !== "/affidi") return null;

  const back = resolveAffidiBackNav(searchParams.toString());
  if (!back) return null;

  return (
    <nav aria-label="Indietro in Affidi">
      <button
        type="button"
        onClick={() => navigateBack(router, back.href)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--navy)] shadow-sm hover:bg-[#f8fafc]"
      >
        <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
        Indietro
      </button>
    </nav>
  );
}
