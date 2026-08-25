"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateGruppoMandantiAction } from "@/actions/gruppoOperatori";
import type { GruppoMandanteAssegnazione } from "@/lib/gruppoMandantiUi";
import type { PerimetroListItem } from "@/lib/mandantePerimetri";

type MandanteOption = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: PerimetroListItem[];
};

export function GruppoMandantiSection({
  initial,
  mandanti,
}: {
  initial: GruppoMandanteAssegnazione[];
  mandanti: MandanteOption[];
}) {
  const [assegnazioni, setAssegnazioni] = useState<GruppoMandanteAssegnazione[]>(initial);
  const [nuovaMandanteId, setNuovaMandanteId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const disponibili = mandanti.filter(
    (m) => !assegnazioni.some((a) => a.mandanteId === m.id)
  );

  function addMandante() {
    if (!nuovaMandanteId) return;
    if (assegnazioni.some((a) => a.mandanteId === nuovaMandanteId)) return;
    setAssegnazioni((prev) => [
      ...prev,
      { mandanteId: nuovaMandanteId, perimetriIds: [] },
    ]);
    setNuovaMandanteId("");
  }

  function removeMandante(mandanteId: string) {
    setAssegnazioni((prev) => prev.filter((a) => a.mandanteId !== mandanteId));
  }

  function togglePerimetro(mandanteId: string, perimetroId: string) {
    setAssegnazioni((prev) =>
      prev.map((a) => {
        if (a.mandanteId !== mandanteId) return a;
        const has = a.perimetriIds.includes(perimetroId);
        return {
          ...a,
          perimetriIds: has
            ? a.perimetriIds.filter((id) => id !== perimetroId)
            : [...a.perimetriIds, perimetroId],
        };
      })
    );
  }

  function salva() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("gruppoMandanti", JSON.stringify(assegnazioni));
        await updateGruppoMandantiAction(fd);
        setMsg("Mandanti e perimetri salvati");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="space-y-3 border-t border-[var(--line)] pt-3">
      <div>
        <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
          Mandanti e perimetri del gruppo
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--muted)]">
          Indica quali mandanti e commesse (perimetri) gestisce questo gruppo operatori.
        </p>
      </div>

      {assegnazioni.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nessuna mandante assegnata al gruppo.</p>
      ) : (
        <div className="space-y-2">
          {assegnazioni.map((a) => {
            const mandante = mandanti.find((m) => m.id === a.mandanteId);
            if (!mandante) return null;
            return (
              <div
                key={a.mandanteId}
                className="rounded border border-[var(--line)] bg-[#fafbfc] p-2"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--navy)]">
                      {mandante.codice} · {mandante.ragioneSociale}
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {a.perimetriIds.length
                        ? `${a.perimetriIds.length} perimetr${a.perimetriIds.length === 1 ? "o" : "i"} selezionat${a.perimetriIds.length === 1 ? "o" : "i"}`
                        : mandante.perimetri.length
                          ? "Tutti i perimetri (nessuna selezione specifica)"
                          : "Nessun perimetro configurato sulla mandante"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMandante(a.mandanteId)}
                    className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                    title="Rimuovi mandante"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {mandante.perimetri.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {mandante.perimetri.map((p) => {
                      const checked = a.perimetriIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] ${
                            checked
                              ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                              : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#eef4f8]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerimetro(a.mandanteId, p.id)}
                            className="sr-only"
                          />
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-700">
                    Configura i perimetri nella scheda mandante (sezione Perimetri / commesse).
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
            Aggiungi mandante
          </span>
          <select
            value={nuovaMandanteId}
            onChange={(e) => setNuovaMandanteId(e.target.value)}
            className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs"
          >
            <option value="">Seleziona mandante…</option>
            {disponibili.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codice} · {m.ragioneSociale}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={addMandante}
          disabled={!nuovaMandanteId}
          className="flex h-8 items-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Aggiungi
        </button>
        <button
          type="button"
          onClick={salva}
          disabled={pending}
          className="h-8 rounded border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--navy)] disabled:opacity-50"
        >
          {pending ? "Salvo..." : "Salva mandanti"}
        </button>
      </div>

      {msg ? <p className="text-xs font-semibold text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-xs font-semibold text-[var(--danger)]">{err}</p> : null}
    </div>
  );
}
