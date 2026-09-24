"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import {
  PORTAFOGLIO_STATI,
  PORTAFOGLIO_STATO_LABELS,
  PORTAFOGLIO_TIPI,
  PORTAFOGLIO_TIPO_LABELS,
  type PortafoglioRecord,
} from "@/lib/portafogli/types";
import {
  aggiornaPortafoglioAction,
  creaPortafoglioAction,
} from "@/actions/portafogli";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Salvataggio…" : label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";

function isoDate(d: Date | null | undefined) {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return x.toISOString().slice(0, 10);
}

export function PortafoglioForm({
  initial,
}: {
  initial?: PortafoglioRecord | null;
}) {
  const isNew = !initial;
  return (
    <form
      action={isNew ? creaPortafoglioAction : aggiornaPortafoglioAction}
      className="space-y-4"
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome *">
          <input
            name="nome"
            required
            defaultValue={initial?.nome ?? ""}
            className={inputClass}
            placeholder="Book Banca X 2026"
          />
        </Field>
        <Field label="Codice">
          <input
            name="codice"
            defaultValue={initial?.codice ?? ""}
            className={inputClass}
            placeholder="NPL-2026-01"
          />
        </Field>
        <Field label="Venditore">
          <input
            name="venditore"
            defaultValue={initial?.venditore ?? ""}
            className={inputClass}
            placeholder="Banca / fondo"
          />
        </Field>
        <Field label="Servicer / gestore">
          <input
            name="servicer"
            defaultValue={initial?.servicer ?? ""}
            className={inputClass}
            placeholder="Società o team di gestione"
          />
        </Field>
        <Field label="Tipo">
          <select name="tipo" defaultValue={initial?.tipo ?? "NPL"} className={inputClass}>
            {PORTAFOGLIO_TIPI.map((t) => (
              <option key={t} value={t}>
                {PORTAFOGLIO_TIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stato">
          <select
            name="stato"
            defaultValue={initial?.stato ?? "IN_VALUTAZIONE"}
            className={inputClass}
          >
            {PORTAFOGLIO_STATI.map((s) => (
              <option key={s} value={s}>
                {PORTAFOGLIO_STATO_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data cut-off">
          <input
            type="date"
            name="dataCutoff"
            defaultValue={isoDate(initial?.dataCutoff)}
            className={inputClass}
          />
        </Field>
        <Field label="Data acquisto / closing">
          <input
            type="date"
            name="dataAcquisto"
            defaultValue={isoDate(initial?.dataAcquisto)}
            className={inputClass}
          />
        </Field>
        <Field label="Nominale dichiarato">
          <input
            name="nominaleDichiarato"
            inputMode="decimal"
            defaultValue={initial?.nominaleDichiarato ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label="Prezzo offerto">
          <input
            name="prezzoOfferto"
            inputMode="decimal"
            defaultValue={initial?.prezzoOfferto ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Prezzo pagato">
          <input
            name="prezzoPagato"
            inputMode="decimal"
            defaultValue={initial?.prezzoPagato ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Spese di acquisto">
          <input
            name="speseAcquisto"
            inputMode="decimal"
            defaultValue={initial?.speseAcquisto ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label="Recupero atteso">
          <input
            name="recuperoAtteso"
            inputMode="decimal"
            defaultValue={initial?.recuperoAtteso ?? ""}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Note">
        <textarea
          name="note"
          rows={3}
          defaultValue={initial?.note ?? ""}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Submit label={isNew ? "Crea portafoglio" : "Salva modifiche"} />
        <Link
          href="/portafogli"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--navy)] hover:bg-slate-50"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
