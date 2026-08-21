"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STATO_LABELS } from "@/lib/permissions";
import { StatoBadge } from "@/components/ui";
import { updatePraticaStatoAction } from "@/actions/core";

const STATI = Object.entries(STATO_LABELS) as [string, string][];

export function StatoPraticaBar({
  praticaId,
  stato,
  promessaAt,
  canEdit,
  compact,
  header,
}: {
  praticaId: string;
  stato: string;
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
    if (!canEdit) {
      return (
        <span className="shrink-0">
          <StatoBadge stato={stato} />
        </span>
      );
    }

    return (
      <div className={`flex shrink-0 items-center gap-1 text-xs ${header ? "" : ""}`}>
        <form action={onSubmit} className="flex items-center gap-1">
          <input type="hidden" name="praticaId" value={praticaId} />
          <select
            name="stato"
            value={statoValue}
            onChange={(e) => setStatoValue(e.target.value)}
            title="Codice scarico"
            className={`h-6 w-auto max-w-[9rem] rounded border px-1.5 text-[11px] ${
              header
                ? "border-white/25 bg-white/95 text-[#132033]"
                : "border-[var(--line)] bg-white text-[#132033]"
            }`}
          >
            {STATI.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {statoValue === "PROMESSA" ? (
            <input
              type="date"
              name="promessaAt"
              required
              value={promessa}
              onChange={(e) => setPromessa(e.target.value)}
              title="Data promessa"
              className={`h-6 w-auto rounded border px-1.5 text-[11px] ${
                header
                  ? "border-white/25 bg-white/95 text-[#132033]"
                  : "border-[var(--line)] bg-white text-[#132033]"
              }`}
            />
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className={`h-6 shrink-0 rounded px-2 text-[11px] font-medium disabled:opacity-60 ${
              header
                ? "border border-white/25 bg-white/15 text-white hover:bg-white/25"
                : "border border-[#132033] bg-[#132033] text-white"
            }`}
          >
            {saving ? "…" : "OK"}
          </button>
        </form>
        {error ? <span className="text-[var(--danger)]">{error}</span> : null}
      </div>
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
