"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  sedeId,
}: {
  mandanti: MandanteFiltroIncassi[];
  mandanteId?: string;
  perimetro?: string;
  sedeId?: string | null;
}) {
  const router = useRouter();
  const [mandante, setMandante] = useState(mandanteId || "");
  const [peri, setPeri] = useState(perimetro || "");

  const perimetriOpts = useMemo(() => {
    if (!mandante) {
      const all = new Set<string>();
      for (const m of mandanti) for (const p of m.perimetri) all.add(p);
      return [...all].sort((a, b) => a.localeCompare(b, "it"));
    }
    return mandanti.find((m) => m.id === mandante)?.perimetri ?? [];
  }, [mandante, mandanti]);

  function buildHref(nextMandante: string, nextPeri: string) {
    const qs = new URLSearchParams();
    if (nextMandante) qs.set("incMandante", nextMandante);
    if (nextPeri) qs.set("incPerimetro", nextPeri);
    if (sedeId) qs.set("sede", sedeId);
    const s = qs.toString();
    return s ? `/?${s}` : "/";
  }

  function applica(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref(mandante, peri));
  }

  function reset() {
    setMandante("");
    setPeri("");
    router.push(buildHref("", ""));
  }

  return (
    <form
      onSubmit={applica}
      className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--line)] bg-[#f8fafc] p-3"
    >
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Mandante</span>
        <select
          value={mandante}
          onChange={(e) => {
            setMandante(e.target.value);
            setPeri("");
          }}
          className="h-9 min-w-[160px] rounded border border-[var(--line)] bg-white px-2 text-sm"
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
          className="h-9 min-w-[160px] rounded border border-[var(--line)] bg-white px-2 text-sm"
        >
          <option value="">Tutti</option>
          {perimetriOpts.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="h-9 rounded border border-[var(--line)] bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90"
      >
        Filtra
      </button>
      {mandante || peri ? (
        <button
          type="button"
          onClick={reset}
          className="h-9 rounded border border-[var(--line)] bg-white px-3 text-sm hover:bg-[#eef4f8]"
        >
          Reset
        </button>
      ) : null}
    </form>
  );
}
