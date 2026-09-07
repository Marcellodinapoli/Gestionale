"use client";

import { useEffect, useState } from "react";
import type { PerimetroGruppoRef } from "@/lib/affidiPerimetro";
import { FILTRI_PAGE_SELECT_LG_CLASS } from "@/components/filtri/filtriFieldStyles";

export function ProvvigioniFiltriAmministrazione({
  mandanti,
  perimetri,
  operatori,
  gruppi,
  mandanteId,
  perimetro,
  operatoreId,
  gruppoId,
}: {
  mandanti: Array<{ id: string; codice: string; ragioneSociale: string }>;
  perimetri: PerimetroGruppoRef[];
  operatori: Array<{ id: string; name: string }>;
  gruppi?: Array<{ id: string; name: string }>;
  mandanteId?: string;
  perimetro?: string;
  operatoreId?: string;
  gruppoId?: string;
}) {
  const [mandanteSel, setMandanteSel] = useState(mandanteId || "");
  const [perimetroSel, setPerimetroSel] = useState(
    mandanteId && perimetro ? perimetro : ""
  );
  const [gruppoSel, setGruppoSel] = useState(gruppoId || "");

  useEffect(() => {
    setMandanteSel(mandanteId || "");
    setPerimetroSel(mandanteId && perimetro ? perimetro : "");
    setGruppoSel(gruppoId || "");
  }, [mandanteId, perimetro, gruppoId]);

  const perimetriMandato = mandanteSel
    ? perimetri.filter((p) => p.mandanteId === mandanteSel)
    : [];
  const perimetroBloccatoDaGruppo = Boolean(gruppoSel);

  return (
    <>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Mandante
        </span>
        <select
          name="mandante"
          value={mandanteSel}
          onChange={(e) => {
            setMandanteSel(e.target.value);
            setPerimetroSel("");
          }}
          className={`min-w-[180px] ${FILTRI_PAGE_SELECT_LG_CLASS}`}
        >
          <option value="">{gruppi ? "Tutte" : "Tutti i mandati"}</option>
          {mandanti.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codice} · {m.ragioneSociale}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Perimetro
        </span>
        <select
          name="perimetro"
          value={mandanteSel && !perimetroBloccatoDaGruppo ? perimetroSel : ""}
          disabled={!mandanteSel || perimetroBloccatoDaGruppo}
          onChange={(e) => setPerimetroSel(e.target.value)}
          title={
            perimetroBloccatoDaGruppo
              ? "Con un gruppo selezionato il filtro perimetro non è disponibile"
              : !mandanteSel
                ? "Seleziona prima una mandante"
                : undefined
          }
          className={`${FILTRI_PAGE_SELECT_LG_CLASS} disabled:opacity-50`}
        >
          <option value="">Tutti</option>
          {perimetriMandato.map((p) => (
            <option key={`${p.mandanteId}|${p.perimetro}`} value={p.perimetro}>
              {p.perimetroLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Operatore
        </span>
        <select
          name="operatore"
          defaultValue={operatoreId || ""}
          className={FILTRI_PAGE_SELECT_LG_CLASS}
        >
          <option value="">Tutti</option>
          {operatori.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {gruppi ? (
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
            Gruppo
          </span>
          <select
            name="gruppo"
            value={gruppoSel}
            onChange={(e) => {
              setGruppoSel(e.target.value);
              if (e.target.value) setPerimetroSel("");
            }}
            className={FILTRI_PAGE_SELECT_LG_CLASS}
          >
            <option value="">Tutti</option>
            {gruppi.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}
