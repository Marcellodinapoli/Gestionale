"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function StatisticheFiltriForm({
  mandanti,
  lottiDisponibili,
  affidoDa,
  affidoA,
  mandanteId,
  lottiSelezionati,
  gruppoId,
  supervisori,
  consentiTuttiGruppi = true,
}: {
  mandanti: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lottiDisponibili: string[];
  affidoDa: string;
  affidoA: string;
  mandanteId?: string;
  lottiSelezionati: string[];
  gruppoId?: string;
  supervisori?: Array<{ id: string; name: string; gruppoNome: string | null }>;
  consentiTuttiGruppi?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [lotti, setLotti] = useState<string[]>(lottiSelezionati);

  const lottiQuery = lottiSelezionati.join(",");
  useEffect(() => {
    setLotti(lottiQuery ? lottiQuery.split(",") : []);
  }, [lottiQuery]);

  function toggleLotto(value: string) {
    setLotti((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  }

  return (
    <form
      className="mb-3 space-y-2 rounded-lg border border-[var(--line)] bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const qs = new URLSearchParams();
        for (const key of ["affidoDa", "affidoA", "mandanteId", "gruppo"]) {
          const val = String(fd.get(key) || "").trim();
          if (val) qs.set(key, val);
        }
        const keep = sp.get("vista");
        if (keep) qs.set("vista", keep);
        if (lotti.length) qs.set("lotto", lotti.join(","));
        router.push(`/statistiche?${qs.toString()}`);
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">Affido da</span>
          <input
            type="date"
            name="affidoDa"
            defaultValue={affidoDa}
            className="h-9 rounded border border-[var(--line)] px-2 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">Affido a</span>
          <input
            type="date"
            name="affidoA"
            defaultValue={affidoA}
            className="h-9 rounded border border-[var(--line)] px-2 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">Mandato</span>
          <select
            name="mandanteId"
            defaultValue={mandanteId || ""}
            className="h-9 min-w-[140px] rounded border border-[var(--line)] px-2 text-sm"
          >
            <option value="">Tutti</option>
            {mandanti.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codice}
              </option>
            ))}
          </select>
        </label>
        {supervisori && supervisori.length > 0 && (
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Gruppo</span>
            <select
              name="gruppo"
              defaultValue={gruppoId || ""}
              className="h-9 min-w-[160px] rounded border border-[var(--line)] px-2 text-sm"
            >
              <option value="">{consentiTuttiGruppi ? "Tutti i gruppi" : "Seleziona gruppo"}</option>
              {supervisori.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.gruppoNome || s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          className="h-9 rounded border border-[var(--line)] bg-[#eef2f6] px-4 text-sm font-medium hover:bg-[#dce4ec]"
        >
          Aggiorna
        </button>
      </div>

      <div className="text-xs">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-[var(--muted)]">
            Perimetri {lotti.length ? `(${lotti.length} selezionati)` : "(tutti)"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-[var(--accent)] hover:underline"
              onClick={() => setLotti([...lottiDisponibili])}
            >
              Seleziona tutti
            </button>
            <button
              type="button"
              className="text-[var(--muted)] hover:underline"
              onClick={() => setLotti([])}
            >
              Nessuno (= tutti)
            </button>
          </div>
        </div>
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded border border-[var(--line)] bg-[#f8fafc] p-2">
          {lottiDisponibili.length ? (
            lottiDisponibili.map((l) => {
              const on = lotti.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLotto(l)}
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                    on
                      ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#eef4f8]"
                  }`}
                >
                  {l}
                </button>
              );
            })
          ) : (
            <span className="text-[var(--muted)]">Nessun perimetro nel periodo.</span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          Solo perimetri in lavorazione (esclusi chiusi). Ogni perimetro ha una tabella
          separata.
        </p>
      </div>
    </form>
  );
}
