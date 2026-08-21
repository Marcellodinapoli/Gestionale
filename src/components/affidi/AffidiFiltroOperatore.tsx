"use client";

import { useRouter } from "next/navigation";

function hrefOperatore(operatore?: string, coda?: string) {
  const sp = new URLSearchParams();
  if (operatore) sp.set("operatore", operatore);
  if (coda) sp.set("coda", coda);
  const qs = sp.toString();
  return qs ? `/affidi?${qs}` : "/affidi";
}

export function AffidiFiltroOperatore({
  operatori,
  selezionatoId,
  coda,
}: {
  operatori: Array<{ id: string; name: string }>;
  selezionatoId?: string;
  coda?: string;
}) {
  const router = useRouter();

  return (
    <label className="mb-3 flex max-w-sm flex-col text-sm">
      <span className="mb-1 text-xs font-semibold text-[var(--muted)]">
        Operatore del gruppo
      </span>
      <select
        value={selezionatoId || ""}
        onChange={(e) => {
          const id = e.target.value || undefined;
          router.push(hrefOperatore(id, coda));
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
