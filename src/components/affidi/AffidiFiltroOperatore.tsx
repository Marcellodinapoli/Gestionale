"use client";

import { useRouter } from "next/navigation";
import { buildAffidiHref, type AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";

export function AffidiFiltroOperatore({
  operatori,
  selezionatoId,
  coda,
  nav,
}: {
  operatori: Array<{ id: string; name: string }>;
  selezionatoId?: string;
  coda?: string;
  nav?: Pick<AffidiNavParams, "mandato" | "perimetro">;
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
        className="h-9 rounded-lg border border-[var(--line)] px-2 text-sm"
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
