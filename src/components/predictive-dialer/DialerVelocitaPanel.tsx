"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui";
import { updateDialerPacingAction } from "@/actions/predictiveDialer";
import {
  DIALER_PACING_DEFAULT,
  DIALER_PACING_MAX,
  DIALER_PACING_MIN,
} from "@/lib/predictive-dialer/pacing";
import type { DialerCampagnaStatsDto } from "@/lib/predictive-dialer/types";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_PAGE_INPUT_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export function DialerVelocitaPanel({
  campagnaId,
  stats,
  editable = true,
  compact = false,
}: {
  campagnaId: string;
  stats: DialerCampagnaStatsDto;
  editable?: boolean;
  /** Nasconde metriche già presenti nel pannello avanzamento. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pacing, dialerStato, campagnaStato } = stats;
  const canEditPacing =
    editable && campagnaStato !== "TERMINATA" && dialerStato.providerSupportsSetPacing;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEditPacing) return;
    setPending(true);
    setError(null);
    const pacingValue = Number(new FormData(e.currentTarget).get("pacing"));
    try {
      await updateDialerPacingAction(campagnaId, pacingValue);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore aggiornamento pacing");
    } finally {
      setPending(false);
    }
  }

  const velocitaLabel =
    pacing.actualCallsPerMinuteSource === "provider" ? "dal provider VoIP" : "non disponibile";

  const metrics = compact
    ? [
        {
          label: "Pacing configurato",
          value: pacing.pacingRatio.toFixed(1),
          hint: "linee per operatore libero",
        },
        {
          label: "Chiamate simultanee",
          value: pacing.chiamateSimultaneeStimate.toFixed(1),
          hint: "stima locale",
        },
        {
          label: "Chiamate/min effettive",
          value:
            pacing.actualCallsPerMinute != null ? pacing.actualCallsPerMinute.toFixed(1) : "—",
          hint: velocitaLabel,
        },
      ]
    : [
        {
          label: "Pacing configurato",
          value: pacing.pacingRatio.toFixed(1),
          hint: "linee per operatore libero",
        },
        {
          label: "Operatori disponibili",
          value: String(pacing.operatoriDisponibili),
          hint: "accettati e pronti",
        },
        {
          label: "Chiamate simultanee",
          value: pacing.chiamateSimultaneeStimate.toFixed(1),
          hint: "stima locale",
        },
        {
          label: "Chiamate/min effettive",
          value:
            pacing.actualCallsPerMinute != null ? pacing.actualCallsPerMinute.toFixed(1) : "—",
          hint: velocitaLabel,
        },
        {
          label: "In coda",
          value: String(pacing.praticheInCoda),
          hint: "da contattare",
        },
      ];

  return (
    <Card title={compact ? "Pacing dialer" : "Pacing e velocità"}>
      <div
        className={`grid gap-4 ${compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-5"}`}
      >
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {m.label}
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--navy)]">{m.value}</p>
            <p className="text-xs text-[var(--muted)]">{m.hint}</p>
          </div>
        ))}
      </div>

      {canEditPacing ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-4">
          {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Pacing ratio</span>
            <input
              name="pacing"
              type="number"
              step="0.1"
              min={DIALER_PACING_MIN}
              max={DIALER_PACING_MAX}
              defaultValue={pacing.pacingRatio ?? DIALER_PACING_DEFAULT}
              className={FILTRI_PAGE_INPUT_CLASS}
            />
          </label>
          <button type="submit" disabled={pending} className={FILTRI_APPLY_BUTTON_CLASS}>
            {pending ? "Salvataggio…" : "Aggiorna pacing"}
          </button>
        </form>
      ) : !compact ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          {campagnaStato === "TERMINATA" ? "Campagna terminata. " : null}
          {!dialerStato.providerSupportsSetPacing
            ? "Modifica pacing disponibile con provider VoIP collegato. "
            : null}
          {dialerStato.messaggio ?? null}
        </p>
      ) : null}
    </Card>
  );
}
