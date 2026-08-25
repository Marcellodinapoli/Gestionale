"use client";

import { useMemo, useState } from "react";
import { euro } from "@/lib/domainFormat";

export function SaldoStralcioPopup({ residuo }: { residuo: number }) {
  const [percentuale, setPercentuale] = useState(70);
  const [importoManuale, setImportoManuale] = useState("");

  const daPercentuale = useMemo(
    () => Math.round(residuo * (percentuale / 100) * 100) / 100,
    [residuo, percentuale]
  );
  const sconto = Math.round((residuo - daPercentuale) * 100) / 100;
  const importoCustom = Number(importoManuale.replace(",", "."));
  const haCustom = importoManuale.trim() !== "" && !Number.isNaN(importoCustom);

  return (
    <div className="space-y-3 px-3 py-3 text-sm">
      <p className="text-[var(--muted)]">
        Residuo pratica:{" "}
        <span className="font-semibold tabular-nums text-[var(--navy)]">
          {euro(residuo)}
        </span>
      </p>
      <label className="block text-xs">
        <span className="font-semibold text-[var(--muted)]">
          Percentuale proposta ({percentuale}%)
        </span>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={percentuale}
          onChange={(e) => setPercentuale(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <div className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2">
        <p className="text-xs text-[var(--muted)]">Saldo a stralcio</p>
        <p className="text-xl font-bold tabular-nums text-[var(--navy)]">
          {euro(daPercentuale)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Sconto: {euro(sconto)} ({Math.round(100 - percentuale)}%)
        </p>
      </div>
      <label className="block text-xs">
        <span className="font-semibold text-[var(--muted)]">
          Oppure importo proposto (€)
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={importoManuale}
          onChange={(e) => setImportoManuale(e.target.value)}
          placeholder="es. 1500"
          className="mt-0.5 w-full rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2"
        />
      </label>
      {haCustom ? (
        <p className="text-xs text-[var(--muted)]">
          Proposta:{" "}
          <span className="font-semibold tabular-nums text-[var(--navy)]">
            {euro(importoCustom)}
          </span>{" "}
          ·{" "}
          {residuo > 0
            ? `${Math.round((importoCustom / residuo) * 1000) / 10}% del residuo`
            : "—"}
        </p>
      ) : null}
      <p className="text-[11px] text-[var(--muted)]">
        Solo calcolo in scheda: non registra l’accordo. Usa nota/esito per fissarlo.
      </p>
    </div>
  );
}
