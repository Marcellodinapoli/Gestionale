"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STATO_LABELS } from "@/lib/permissions";
import { StatoBadge } from "@/components/ui";
import { updatePraticaStatoAction } from "@/actions/core";

const STATI = Object.entries(STATO_LABELS) as [string, string][];

function chiaveStato(stato: string, filtroStato?: string | null) {
  return filtroStato && filtroStato in STATO_LABELS ? filtroStato : stato;
}

export function StatoPraticaBar({
  praticaId,
  stato,
  filtroStato,
  promessaAt,
  canEdit,
  compact,
}: {
  praticaId: string;
  stato: string;
  /** Stato del filtro elenco (coda): se presente, viene mostrato al posto dello stato pratica. */
  filtroStato?: string | null;
  promessaAt?: string | null;
  canEdit: boolean;
  compact?: boolean;
  header?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statoValue, setStatoValue] = useState(stato);
  const [promessa, setPromessa] = useState(promessaAt || "");

  useEffect(() => {
    setStatoValue(stato);
    setPromessa(promessaAt || "");
  }, [stato, promessaAt]);

  async function onSubmit(formData: FormData) {
    setError(null);
    setSaving(true);
    try {
      await updatePraticaStatoAction(formData);
      setStatoValue(String(formData.get("stato") || statoValue));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore salvataggio stato");
    } finally {
      setSaving(false);
    }
  }

  if (compact) {
    return (
      <span className="shrink-0">
        <StatoBadge stato={chiaveStato(stato, filtroStato)} />
      </span>
    );
  }

  if (!canEdit) return null;

  return (
    <div className="shrink-0 border-t border-[var(--line)] bg-[#dce4ec] text-xs">
      <div className="flex flex-wrap items-end gap-2 px-3 py-1.5">
        <form action={onSubmit} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="praticaId" value={praticaId} />
          <label>
            <span className="font-semibold text-[#1a365d]">Cod. scarico</span>
            <select
              name="stato"
              value={statoValue}
              onChange={(e) => setStatoValue(e.target.value)}
              className="ml-0 mt-0.5 block h-8 min-w-[160px] rounded border border-[var(--line)] bg-white px-2 text-sm text-[#132033]"
            >
              {STATI.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {statoValue === "PROMESSA" ? (
            <label>
              <span className="font-semibold text-[#1a365d]">Data promessa</span>
              <input
                type="date"
                name="promessaAt"
                required
                value={promessa}
                onChange={(e) => setPromessa(e.target.value)}
                className="ml-0 mt-0.5 block h-8 min-w-[160px] rounded border border-[var(--line)] bg-white px-2 text-sm text-[#132033]"
              />
            </label>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="h-8 rounded bg-[#132033] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? "…" : "Applica stato"}
          </button>
        </form>
        {error ? <span className="text-[var(--danger)]">{error}</span> : null}
      </div>
    </div>
  );
}
