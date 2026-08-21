"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { salvaImpegnoLiberoAction } from "@/actions/impegnoAgenda";
import { AgendaCalendarioPicker, toAgendaLocalValue } from "@/components/agenda/AgendaCalendarioPicker";

export function ImpegnoLiberoForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [titolo, setTitolo] = useState("");
  const [nota, setNota] = useState("");
  const [scheduledAt, setScheduledAt] = useState(toAgendaLocalValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSchedule = useCallback((localValue: string) => {
    setScheduledAt(localValue);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("titolo", titolo);
      fd.set("nota", nota);
      fd.set("scheduledAt", scheduledAt);
      await salvaImpegnoLiberoAction(fd);
      setTitolo("");
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
      <label className="mb-3 block text-xs">
        <span className="font-semibold text-[var(--muted)]">Titolo impegno</span>
        <input
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          required
          placeholder="Es. Riunione team, chiamata banca…"
          className="mt-0.5 h-9 w-full rounded border border-[var(--line)] px-2 text-sm"
        />
      </label>
      <AgendaCalendarioPicker onChange={onSchedule} />
      <label className="mt-3 block text-xs">
        <span className="font-semibold text-[var(--muted)]">Nota</span>
        <textarea
          rows={3}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Dettagli opzionali"
          className="mt-0.5 w-full resize-y rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2 font-sans text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="mt-3 h-9 rounded bg-[var(--navy)] px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Salvataggio…" : "Salva in agenda"}
      </button>
      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
