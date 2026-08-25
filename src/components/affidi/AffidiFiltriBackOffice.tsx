"use client";

import { useRouter } from "next/navigation";
import {
  buildAffidiHref,
  parseCodaAffidi,
  type AffidiNavParams,
} from "@/components/affidi/AffidiCaricoOperatori";
import type { PerimetroGruppoRef } from "@/lib/affidiPerimetro";

export function AffidiFiltriBackOffice({
  mandanti,
  perimetri,
  operatori,
  mandatoId,
  perimetro,
  operatoreId,
  coda,
}: {
  mandanti: Array<{ id: string; codice: string; ragioneSociale: string }>;
  perimetri: PerimetroGruppoRef[];
  operatori: Array<{ id: string; name: string }>;
  mandatoId?: string;
  perimetro?: string;
  operatoreId?: string;
  coda?: string;
}) {
  const router = useRouter();
  const codaParsed = parseCodaAffidi(coda);
  const perimetriMandato = mandatoId
    ? perimetri.filter((p) => p.mandanteId === mandatoId)
    : [];

  function vai(params: AffidiNavParams) {
    router.push(buildAffidiHref(params));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
          Mandato
        </span>
        <select
          value={mandatoId || ""}
          onChange={(e) => {
            const mandato = e.target.value || undefined;
            vai({
              mandato,
              operatore: operatoreId,
              coda: codaParsed,
            });
          }}
          className="h-9 min-w-[10rem] rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
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
        <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
          Perimetro
        </span>
        <select
          value={perimetro && mandatoId ? perimetro : ""}
          disabled={!mandatoId}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) {
              vai({ mandato: mandatoId, operatore: operatoreId, coda: codaParsed });
              return;
            }
            vai({
              mandato: mandatoId,
              perimetro: next,
              operatore: operatoreId,
              coda: codaParsed,
            });
          }}
          className="h-9 min-w-[10rem] rounded-lg border border-[var(--line)] bg-white px-2 text-sm disabled:opacity-50"
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
        <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
          Operatore
        </span>
        <select
          value={operatoreId || ""}
          onChange={(e) => {
            const operatore = e.target.value || undefined;
            vai({
              mandato: mandatoId,
              perimetro,
              operatore,
              coda: codaParsed,
            });
          }}
          className="h-9 min-w-[10rem] rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
        >
          <option value="">Tutti gli operatori</option>
          {operatori.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
