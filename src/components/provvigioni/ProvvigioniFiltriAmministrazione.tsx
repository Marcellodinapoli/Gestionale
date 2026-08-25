"use client";

import type { PerimetroGruppoRef } from "@/lib/affidiPerimetro";

export function ProvvigioniFiltriAmministrazione({
  mandanti,
  perimetri,
  operatori,
  mandanteId,
  perimetro,
  operatoreId,
}: {
  mandanti: Array<{ id: string; codice: string; ragioneSociale: string }>;
  perimetri: PerimetroGruppoRef[];
  operatori: Array<{ id: string; name: string }>;
  mandanteId?: string;
  perimetro?: string;
  operatoreId?: string;
}) {
  const perimetriMandato = mandanteId
    ? perimetri.filter((p) => p.mandanteId === mandanteId)
    : [];

  return (
    <>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Mandato</span>
        <select
          name="mandante"
          defaultValue={mandanteId || ""}
          className="h-10 min-w-[180px] rounded-lg border border-[var(--line)] px-3 text-sm"
        >
          <option value="">Tutti i mandati</option>
          {mandanti.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codice} · {m.ragioneSociale}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Perimetro</span>
        <select
          name="perimetro"
          defaultValue={mandanteId && perimetro ? perimetro : ""}
          disabled={!mandanteId}
          className="h-10 min-w-[160px] rounded-lg border border-[var(--line)] px-3 text-sm disabled:opacity-50"
        >
          <option value="">Tutti i perimetri</option>
          {perimetriMandato.map((p) => (
            <option key={`${p.mandanteId}|${p.perimetro}`} value={p.perimetro}>
              {p.perimetroLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Operatore</span>
        <select
          name="operatore"
          defaultValue={operatoreId || ""}
          className="h-10 min-w-[160px] rounded-lg border border-[var(--line)] px-3 text-sm"
        >
          <option value="">Tutti</option>
          {operatori.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
