"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { salvaMemoAgendaAction } from "@/actions/core";
import { AgendaCalendarioPicker, toAgendaLocalValue } from "@/components/agenda/AgendaCalendarioPicker";

type PraticaHit = {
  id: string;
  numero: string;
  debitore: string;
};

export function ImpegnoPraticaForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PraticaHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PraticaHit | null>(null);
  const [scheduledAt, setScheduledAt] = useState(toAgendaLocalValue(new Date()));
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSchedule = useCallback((localValue: string) => {
    setScheduledAt(localValue);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (selected || term.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ campo: "nominativo", q: term });
        const res = await fetch(`/api/pratiche-cerca?${params.toString()}`);
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { pratiche: PraticaHit[] };
        if (!cancelled) setHits(data.pratiche);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, selected]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Seleziona una pratica dall'elenco");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("praticaId", selected.id);
      fd.set("scheduledAt", scheduledAt);
      fd.set("nota", nota);
      await salvaMemoAgendaAction(fd);
      setSelected(null);
      setQ("");
      setHits([]);
      setNota("");
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {selected ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[#eef4f8] px-3 py-2 text-sm">
          <span>
            <span className="font-medium text-[var(--accent)]">{selected.numero}</span> ·{" "}
            {selected.debitore}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQ("");
              setHits([]);
            }}
            className="text-xs text-[var(--accent)] underline"
          >
            Cambia pratica
          </button>
        </div>
      ) : (
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Cerca pratica (debitore o numero)
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Es. Rossi o PRC-2026-0001"
            className="h-9 w-full max-w-md rounded-lg border border-[var(--line)] px-2 text-sm"
          />
        </label>
      )}

      {!selected ? (
        <>
          {loading ? <p className="mb-2 text-xs text-[var(--muted)]">Ricerca…</p> : null}
          {hits.length ? (
            <ul className="mb-3 max-h-40 overflow-auto rounded-lg border border-[var(--line)] bg-white text-sm">
              {hits.map((p) => (
                <li key={p.id} className="border-t border-[var(--line)] first:border-t-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setQ("");
                      setHits([]);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#eef4f8]"
                  >
                    <span>
                      <span className="font-medium text-[var(--accent)]">{p.numero}</span>{" "}
                      {p.debitore}
                    </span>
                    <span className="text-xs text-[var(--muted)]">Scegli →</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 && !loading ? (
            <p className="mb-2 text-xs text-[var(--muted)]">Nessuna pratica trovata.</p>
          ) : !q.trim() ? (
            <p className="mb-3 text-xs text-[var(--muted)]">
              Digita almeno 2 caratteri e seleziona la pratica.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mb-1 text-xs font-semibold text-[var(--muted)]">Data e ora</div>
      <AgendaCalendarioPicker onChange={onSchedule} />

      <label className="mt-3 block text-xs">
        <span className="font-semibold text-[var(--muted)]">Nota agenda</span>
        <textarea
          rows={3}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Testo del richiamo (opzionale)"
          className="mt-0.5 w-full resize-y rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2 font-sans text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={saving || !selected}
        className="mt-3 h-9 rounded bg-[var(--navy)] px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Salvataggio…" : "Salva in agenda"}
      </button>
      {!selected ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Seleziona una pratica per abilitare il salvataggio.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
