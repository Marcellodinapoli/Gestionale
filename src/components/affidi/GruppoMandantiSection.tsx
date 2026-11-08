"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateGruppoMandantiAction } from "@/actions/gruppoOperatori";
import {
  messaggioErroreGruppoMandanti,
  type GruppoMandanteAssegnazione,
} from "@/lib/gruppoMandantiUi";
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
  supervisorId,
}: {
  initial: GruppoMandanteAssegnazione[];
  mandanti: MandanteOption[];
  supervisorId: string;
}) {
  const [assegnazioni, setAssegnazioni] = useState<GruppoMandanteAssegnazione[]>(initial);
  const [nuovaMandanteId, setNuovaMandanteId] = useState("");
  const [nuovoPerimetroId, setNuovoPerimetroId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mandanteSelezionata = mandanti.find((m) => m.id === nuovaMandanteId);
  const perimetriGiàAssegnati = new Set(
    assegnazioni
      .filter((a) => a.mandanteId === nuovaMandanteId)
      .flatMap((a) => a.perimetriIds)
  );
  const perimetriDisponibili =
    mandanteSelezionata?.perimetri.filter((p) => !perimetriGiàAssegnati.has(p.id)) ?? [];

  function addMandantePerimetro() {
    if (!nuovaMandanteId || !nuovoPerimetroId) return;
    setAssegnazioni((prev) => {
      const idx = prev.findIndex((a) => a.mandanteId === nuovaMandanteId);
      if (idx >= 0) {
        if (prev[idx].perimetriIds.includes(nuovoPerimetroId)) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          perimetriIds: [...next[idx].perimetriIds, nuovoPerimetroId],
        };
        return next;
      }
      return [...prev, { mandanteId: nuovaMandanteId, perimetriIds: [nuovoPerimetroId] }];
    });
    setNuovoPerimetroId("");
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
    const validationErr = messaggioErroreGruppoMandanti(assegnazioni);
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("gruppoSupervisorId", supervisorId);
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
          Per ogni mandante scegli almeno un perimetro (commessa). Obbligatorio per salvare il
          gruppo.
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
                        : "Seleziona almeno un perimetro"}
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
        <label className="min-w-[180px] flex-1 text-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
            Mandante
          </span>
          <select
            value={nuovaMandanteId}
            onChange={(e) => {
              setNuovaMandanteId(e.target.value);
              setNuovoPerimetroId("");
            }}
            className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs"
          >
            <option value="">Seleziona mandante…</option>
            {mandanti.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codice} · {m.ragioneSociale}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[180px] flex-1 text-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
            Perimetro
          </span>
          <select
            value={nuovoPerimetroId}
            onChange={(e) => setNuovoPerimetroId(e.target.value)}
            disabled={!nuovaMandanteId || perimetriDisponibili.length === 0}
            className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs disabled:opacity-50"
          >
            <option value="">
              {!nuovaMandanteId
                ? "Prima la mandante…"
                : perimetriDisponibili.length
                  ? "Seleziona perimetro…"
                  : "Nessun perimetro disponibile"}
            </option>
            {perimetriDisponibili.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={addMandantePerimetro}
          disabled={!nuovaMandanteId || !nuovoPerimetroId}
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
