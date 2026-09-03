"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { incMeseSelectOptions } from "@/lib/incassiMeseFiltro";
import { buildAffidiHref, type AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";
import type { MandantePerimetriAffidi } from "@/lib/affidi/affidiMonitorPerimetri";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_BAR_CONTAINER_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
  FILTRI_RESET_BUTTON_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export function AffidiCaricoFiltri({
  mandanti,
  operatori,
  caricoMandato,
  caricoPerimetro,
  caricoMese,
  operatoreId,
  extraParams,
}: {
  mandanti: MandantePerimetriAffidi[];
  operatori: Array<{ id: string; name: string }>;
  caricoMandato?: string;
  caricoPerimetro?: string;
  caricoMese?: string;
  operatoreId?: string;
  extraParams?: Pick<AffidiNavParams, "mandato" | "perimetro" | "coda" | "sezione">;
}) {
  const router = useRouter();
  const [mandato, setMandato] = useState(caricoMandato || "");
  const [peri, setPeri] = useState(caricoPerimetro || "");
  const [meseSel, setMeseSel] = useState(caricoMese || "");
  const [operatore, setOperatore] = useState(operatoreId || "");
  const meseOpts = useMemo(() => incMeseSelectOptions(), []);

  const perimetriOpts = useMemo(() => {
    if (!mandato) {
      const all = new Set<string>();
      for (const m of mandanti) for (const p of m.perimetri) all.add(p);
      return [...all].sort((a, b) => a.localeCompare(b, "it"));
    }
    return mandanti.find((m) => m.id === mandato)?.perimetri ?? [];
  }, [mandato, mandanti]);

  function buildHref(next: {
    caricoMandato: string;
    caricoPerimetro: string;
    caricoMese: string;
    operatore: string;
  }) {
    return buildAffidiHref({
      ...extraParams,
      caricoMandato: next.caricoMandato || undefined,
      caricoPerimetro: next.caricoPerimetro || undefined,
      caricoMese: next.caricoMese || undefined,
      operatore: next.operatore || undefined,
    });
  }

  function applica(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref({ caricoMandato: mandato, caricoPerimetro: peri, caricoMese: meseSel, operatore }));
  }

  function reset() {
    setMandato("");
    setPeri("");
    setMeseSel("");
    setOperatore("");
    router.push(buildHref({ caricoMandato: "", caricoPerimetro: "", caricoMese: "", operatore: "" }));
  }

  const hasFiltri = mandato || peri || meseSel || operatore;

  return (
    <form
      onSubmit={applica}
      className={`flex flex-wrap items-end gap-2 ${FILTRI_BAR_CONTAINER_CLASS}`}
    >
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Mandato</span>
        <select
          value={mandato}
          onChange={(e) => {
            setMandato(e.target.value);
            setPeri("");
          }}
          className={FILTRI_PAGE_SELECT_CLASS}
        >
          <option value="">Tutti</option>
          {mandanti.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codice}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Perimetro</span>
        <select
          value={peri}
          onChange={(e) => setPeri(e.target.value)}
          className={FILTRI_PAGE_SELECT_CLASS}
        >
          <option value="">Tutti</option>
          {perimetriOpts.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Operatore</span>
        <select
          value={operatore}
          onChange={(e) => setOperatore(e.target.value)}
          className={FILTRI_PAGE_SELECT_CLASS}
        >
          <option value="">Tutti</option>
          {operatori.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Mese</span>
        <select
          value={meseSel}
          onChange={(e) => setMeseSel(e.target.value)}
          className={FILTRI_PAGE_SELECT_CLASS}
        >
          {meseOpts.map((o) => (
            <option key={o.value || "corrente"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={FILTRI_APPLY_BUTTON_CLASS}>
        Filtra
      </button>
      {hasFiltri ? (
        <button type="button" onClick={reset} className={FILTRI_RESET_BUTTON_CLASS}>
          Reset
        </button>
      ) : null}
    </form>
  );
}
