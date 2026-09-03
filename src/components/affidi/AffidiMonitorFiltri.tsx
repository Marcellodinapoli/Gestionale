"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAffidiHref, type AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";
import type { MandantePerimetriAffidi } from "@/lib/affidi/affidiMonitorPerimetri";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_BAR_CONTAINER_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
  FILTRI_RESET_BUTTON_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export function AffidiMonitorFiltri({
  mandanti,
  mandatoId,
  perimetro,
  extraParams,
}: {
  mandanti: MandantePerimetriAffidi[];
  mandatoId?: string;
  perimetro?: string;
  extraParams?: Pick<
    AffidiNavParams,
    "operatore" | "coda" | "sezione" | "caricoMandato" | "caricoPerimetro" | "caricoMese"
  >;
}) {
  const router = useRouter();
  const [mandato, setMandato] = useState(mandatoId || "");
  const [peri, setPeri] = useState(perimetro || "");

  const perimetriOpts = useMemo(() => {
    if (!mandato) {
      const all = new Set<string>();
      for (const m of mandanti) for (const p of m.perimetri) all.add(p);
      return [...all].sort((a, b) => a.localeCompare(b, "it"));
    }
    return mandanti.find((m) => m.id === mandato)?.perimetri ?? [];
  }, [mandato, mandanti]);

  function buildHref(nextMandato: string, nextPeri: string) {
    return buildAffidiHref({
      ...extraParams,
      mandato: nextMandato || undefined,
      perimetro: nextPeri || undefined,
    });
  }

  function applica(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref(mandato, peri));
  }

  function reset() {
    setMandato("");
    setPeri("");
    router.push(buildHref("", ""));
  }

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
      <button type="submit" className={FILTRI_APPLY_BUTTON_CLASS}>
        Filtra
      </button>
      {mandato || peri ? (
        <button type="button" onClick={reset} className={FILTRI_RESET_BUTTON_CLASS}>
          Reset
        </button>
      ) : null}
    </form>
  );
}
