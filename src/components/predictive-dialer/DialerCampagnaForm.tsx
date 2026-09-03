"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDialerCampagnaAction } from "@/actions/predictiveDialer";
import { CODICI_SCARICO } from "@/lib/scarico";
import {
  DIALER_PACING_DEFAULT,
  DIALER_PACING_MAX,
  DIALER_PACING_MIN,
} from "@/lib/predictive-dialer/pacing";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_PAGE_INPUT_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export function DialerCampagnaForm({
  operatori,
}: {
  operatori: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const selected = operatori
      .filter((o) => fd.get(`op_${o.id}`) === "on")
      .map((o) => o.id);
    fd.set("operatoreIds", selected.join(","));
    try {
      const id = await createDialerCampagnaAction(fd);
      router.push(`/predictive-dialer/campagne/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Nome campagna</span>
        <input name="nome" required className={FILTRI_PAGE_INPUT_CLASS} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Descrizione</span>
        <textarea name="descrizione" rows={2} className={`${FILTRI_PAGE_INPUT_CLASS} w-full`} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Codici scarico</span>
        <select name="codiciScarico" multiple className={`${FILTRI_PAGE_SELECT_CLASS} h-24`}>
          {CODICI_SCARICO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--muted)]">Ctrl+click per selezione multipla</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Post-call (secondi)</span>
        <input
          name="postCallSec"
          type="number"
          min={10}
          max={600}
          defaultValue={60}
          className={FILTRI_PAGE_INPUT_CLASS}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          Pacing ratio (chiamate per operatore)
        </span>
        <input
          name="pacingRatio"
          type="number"
          step="0.1"
          min={DIALER_PACING_MIN}
          max={DIALER_PACING_MAX}
          defaultValue={DIALER_PACING_DEFAULT}
          className={FILTRI_PAGE_INPUT_CLASS}
        />
        <span className="text-xs text-[var(--muted)]">
          Es. 1,0 = 1 linea per operatore libero · 1,5 = fino a 2 linee parallele
        </span>
      </label>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-[var(--muted)]">Operatori del gruppo</legend>
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-[var(--line)] p-2">
          {operatori.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`op_${o.id}`} />
              {o.name}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={pending} className={FILTRI_APPLY_BUTTON_CLASS}>
        {pending ? "Creazione…" : "Crea campagna"}
      </button>
    </form>
  );
}
