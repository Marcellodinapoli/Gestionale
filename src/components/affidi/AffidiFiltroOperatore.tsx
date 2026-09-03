"use client";

import { useRouter } from "next/navigation";
import { buildAffidiHref, type AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";
import { FILTRI_PAGE_SELECT_CLASS } from "@/components/filtri/filtriFieldStyles";

export function AffidiFiltroOperatore({
  operatori,
  selezionatoId,
  coda,
  nav,
}: {
  operatori: Array<{ id: string; name: string }>;
  selezionatoId?: string;
  coda?: string;
  nav?: Pick<AffidiNavParams, "mandato" | "perimetro" | "caricoMandato" | "caricoPerimetro" | "caricoMese">;
}) {
  const router = useRouter();

  return (
    <label className="mb-3 flex max-w-sm flex-col text-sm">
      <span className="mb-1 text-xs font-semibold text-[var(--muted)]">Operatore</span>
      <select
        value={selezionatoId || ""}
        onChange={(e) => {
          const id = e.target.value || undefined;
          router.push(
            buildAffidiHref({
              ...nav,
              operatore: id,
              coda: coda as AffidiNavParams["coda"],
            })
          );
        }}
        className={FILTRI_PAGE_SELECT_CLASS}
      >
        <option value="">Tutti gli operatori</option>
        {operatori.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
