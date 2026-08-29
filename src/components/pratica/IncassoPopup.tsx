"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addIncassoAction } from "@/actions/core";
import { METODI_INCASSO } from "@/lib/metodoIncasso";

export function IncassoPopup({
  praticaId,
  onDone,
}: {
  praticaId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      await addIncassoAction(fd);
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrazione non riuscita");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-3 py-3 text-sm">
      <input type="hidden" name="praticaId" value={praticaId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">Importo</span>
          <input
            name="importo"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0,00"
            className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">Metodo</span>
          <select
            name="metodo"
            className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
          >
            {METODI_INCASSO.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">Data</span>
          <input
            type="date"
            name="data"
            className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold text-[var(--muted)]">Causale</span>
          <input
            name="causale"
            placeholder="Causale"
            className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
          />
        </label>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          className="h-9 rounded border border-[var(--line)] bg-white px-3 text-sm"
          onClick={onDone}
          disabled={saving}
        >
          Annulla
        </button>
        <button
          type="submit"
          className="h-9 rounded bg-[var(--navy)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Registrazione…" : "Registra"}
        </button>
      </div>
    </form>
  );
}
