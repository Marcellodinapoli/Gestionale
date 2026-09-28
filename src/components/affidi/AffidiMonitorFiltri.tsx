"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAffidiHref, type AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";
import {
  valoriPerimetroMandante,
  type MandantePerimetriAffidi,
} from "@/lib/affidi/affidiMonitorPerimetri";
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
  searchActive,
  extraParams,
}: {
  mandanti: MandantePerimetriAffidi[];
  mandatoId?: string;
  perimetro?: string;
  /** Elenco Affida già caricato (affidaCerca / allerta). */
  searchActive?: boolean;
  extraParams?: Pick<
    AffidiNavParams,
    | "operatore"
    | "coda"
    | "sezione"
    | "caricoMandato"
    | "caricoPerimetro"
    | "caricoMese"
    | "caricoCerca"
    | "allerta"
  >;
}) {
  const router = useRouter();
  const [mandato, setMandato] = useState(mandatoId || "");
  const [peri, setPeri] = useState(perimetro || "");

  const perimetriOpts = useMemo(
    () => valoriPerimetroMandante(mandanti, mandato || undefined),
    [mandato, mandanti]
  );

  function buildHref(
    nextMandato: string,
    nextPeri: string,
    opts?: { cerca?: boolean; clearAllerta?: boolean }
  ) {
    return buildAffidiHref({
      ...extraParams,
      mandato: nextMandato || undefined,
      perimetro: nextPeri || undefined,
      allerta: opts?.clearAllerta ? undefined : extraParams?.allerta,
      affidaCerca: opts?.cerca ? "1" : undefined,
      sezione: opts?.cerca ? "affida" : undefined,
    });
  }

  function applica(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref(mandato, peri, { cerca: true, clearAllerta: true }));
  }

  function reset() {
    setMandato("");
    setPeri("");
    router.push(buildAffidiHref({ ...extraParams, allerta: undefined, affidaCerca: undefined }));
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
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={FILTRI_APPLY_BUTTON_CLASS}>
        Filtra
      </button>
      {searchActive ? (
        <button type="button" onClick={reset} className={FILTRI_RESET_BUTTON_CLASS}>
          Reset
        </button>
      ) : null}
    </form>
  );
}
