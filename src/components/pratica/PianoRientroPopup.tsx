"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPianoAction } from "@/actions/core";
import { euro } from "@/lib/domainFormat";

export function PianoRientroPopup({
  praticaId,
  residuo,
  onDone,
}: {
  praticaId: string;
  residuo: number;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [nRate, setNRate] = useState(6);
  const [primaScadenza, setPrimaScadenza] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const quota =
    nRate >= 2 ? Math.round((residuo / nRate) * 100) / 100 : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      fd.set("nRate", String(nRate));
      fd.set("primaScadenza", primaScadenza);
      await createPianoAction(fd);
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-3 py-3 text-sm">
      <p className="text-[var(--muted)]">
        Residuo pratica:{" "}
        <span className="font-semibold tabular-nums text-[var(--navy)]">
          {euro(residuo)}
        </span>
      </p>
      <label className="block text-xs">
        <span className="font-semibold text-[var(--muted)]">Numero rate (2–36)</span>
        <input
          type="number"
          min={2}
          max={36}
          value={nRate}
          onChange={(e) => setNRate(Number(e.target.value) || 0)}
          className="mt-0.5 w-full rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2"
        />
      </label>
      <label className="block text-xs">
        <span className="font-semibold text-[var(--muted)]">Prima scadenza</span>
        <input
          type="date"
          required
          value={primaScadenza}
          onChange={(e) => setPrimaScadenza(e.target.value)}
          className="mt-0.5 w-full rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2"
        />
      </label>
      {nRate >= 2 ? (
        <p className="text-xs text-[var(--muted)]">
          Quota indicativa:{" "}
          <span className="font-semibold tabular-nums text-[var(--navy)]">
            {euro(quota)}
          </span>{" "}
          × {nRate} rate
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving || residuo <= 0}
        className="h-9 rounded bg-[var(--navy)] px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Salvataggio…" : "Crea piano di rientro"}
      </button>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
