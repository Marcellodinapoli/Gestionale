"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui";
import { reintegrateCodiciScaricoAction } from "@/actions/predictiveDialer";
import { CODICI_SCARICO } from "@/lib/scarico";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
} from "@/components/filtri/filtriFieldStyles";

const STATI_REINTEGRO = [
  { value: "non_risposta", label: "Non risposta" },
  { value: "conclusa", label: "Conclusa (richiamabile)" },
  { value: "richiamare", label: "Da richiamare" },
] as const;

export function DialerCampagnaRequeuePanel({
  campagnaId,
  codiciCampagna,
  campagnaStato,
}: {
  campagnaId: string;
  codiciCampagna: string[];
  campagnaStato: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canRequeue = campagnaStato === "ATTIVA" || campagnaStato === "PAUSA";
  const codiciOptions = codiciCampagna.length
    ? codiciCampagna
    : [...CODICI_SCARICO];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canRequeue) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const codici = fd.getAll("codiciScarico").map(String).filter(Boolean);
    const statiCoda = fd.getAll("statiCoda").map(String).filter(Boolean);
    const includiNuove = fd.get("includiNuove") === "on";
    try {
      const result = await reintegrateCodiciScaricoAction(campagnaId, {
        codiciScarico: codici,
        statiCoda,
        includiNuove,
      });
      setMessage(
        `Reintegrate: ${result.reset} pratiche rimesse in coda, ${result.added} nuove aggiunte.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore reintegrazione");
    } finally {
      setPending(false);
    }
  }

  if (!canRequeue) {
    return (
      <Card title="Reintegra codici scarico">
        <p className="text-sm text-[var(--muted)]">
          Disponibile solo con campagna attiva o in pausa.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Reintegra codici scarico in coda">
      <p className="mb-3 text-sm text-[var(--muted)]">
        Rimettere in coda le pratiche già in campagna (es. non risposte) e/o aggiungere nuove pratiche
        dal gestionale per i codici scarico selezionati.
      </p>
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mb-2 text-sm text-emerald-800">{message}</p> : null}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Codici scarico</span>
          <select name="codiciScarico" multiple required className={`${FILTRI_PAGE_SELECT_CLASS} h-24`}>
            {codiciOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="mb-1 text-xs font-semibold text-[var(--muted)]">
            Stati coda da reintegrare
          </legend>
          <div className="flex flex-wrap gap-3">
            {STATI_REINTEGRO.map((s) => (
              <label key={s.value} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="statiCoda"
                  value={s.value}
                  defaultChecked={s.value === "non_risposta" || s.value === "richiamare"}
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="includiNuove" defaultChecked />
          Includi anche pratiche nuove dal gestionale (non ancora in campagna)
        </label>
        <button type="submit" disabled={pending} className={FILTRI_APPLY_BUTTON_CLASS}>
          {pending ? "Reintegrazione…" : "Reintegra in coda"}
        </button>
      </form>
    </Card>
  );
}
