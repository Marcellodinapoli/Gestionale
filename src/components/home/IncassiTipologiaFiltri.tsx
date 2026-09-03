"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { incMeseSelectOptions } from "@/lib/incassiMeseFiltro";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_BAR_CONTAINER_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
  FILTRI_RESET_BUTTON_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export type MandanteFiltroIncassi = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: string[];
};

export function IncassiTipologiaFiltri({
  mandanti,
  mandanteId,
  perimetro,
  mese,
  sedeId,
}: {
  mandanti: MandanteFiltroIncassi[];
  mandanteId?: string;
  perimetro?: string;
  mese?: string;
  sedeId?: string | null;
}) {
  const router = useRouter();
  const [mandante, setMandante] = useState(mandanteId || "");
  const [peri, setPeri] = useState(perimetro || "");
  const [meseSel, setMeseSel] = useState(mese || "");
  const meseOpts = useMemo(() => incMeseSelectOptions(), []);

  const perimetriOpts = useMemo(() => {
    if (!mandante) {
      const all = new Set<string>();
      for (const m of mandanti) for (const p of m.perimetri) all.add(p);
      return [...all].sort((a, b) => a.localeCompare(b, "it"));
    }
    return mandanti.find((m) => m.id === mandante)?.perimetri ?? [];
  }, [mandante, mandanti]);

  function buildHref(nextMandante: string, nextPeri: string, nextMese: string) {
    const qs = new URLSearchParams();
    if (nextMandante) qs.set("incMandante", nextMandante);
    if (nextPeri) qs.set("incPerimetro", nextPeri);
    if (nextMese) qs.set("incMese", nextMese);
    if (sedeId) qs.set("sede", sedeId);
    const s = qs.toString();
    return s ? `/?${s}` : "/";
  }

  function applica(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref(mandante, peri, meseSel));
  }

  function reset() {
    setMandante("");
    setPeri("");
    setMeseSel("");
    router.push(buildHref("", "", ""));
  }

  return (
    <form
      onSubmit={applica}
      className={`mb-4 flex flex-wrap items-end gap-2 ${FILTRI_BAR_CONTAINER_CLASS}`}
    >
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Mandante</span>
        <select
          value={mandante}
          onChange={(e) => {
            setMandante(e.target.value);
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
      {mandante || peri || meseSel ? (
        <button type="button" onClick={reset} className={FILTRI_RESET_BUTTON_CLASS}>
          Reset
        </button>
      ) : null}
    </form>
  );
}
