"use client";

import type { ReactNode } from "react";
import { CODICI_SCARICO, CODICE_SCARICO_LABELS } from "@/lib/scarico";
import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";

const fieldClass =
  "h-9 w-full rounded border border-[var(--line)] px-2 text-sm text-[var(--navy)]";
const labelClass = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Sezione({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-[var(--line)] pb-5 last:border-b-0 last:pb-0">
      <h3 className="text-sm font-bold text-[var(--navy)]">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function patch(value: AltriFiltri, key: keyof AltriFiltri, v: string) {
  const next = { ...value };
  if (v) next[key] = v as never;
  else delete next[key];
  return next;
}

function DaA({
  label,
  keyDa,
  keyA,
  value,
  onChange,
  type = "date",
  step,
}: {
  label: string;
  keyDa: keyof AltriFiltri;
  keyA: keyof AltriFiltri;
  value: AltriFiltri;
  onChange: (next: AltriFiltri) => void;
  type?: "date" | "text" | "number";
  step?: string;
}) {
  return (
    <div className="min-w-0">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={(value[keyDa] as string | undefined) || ""}
          onChange={(e) => onChange(patch(value, keyDa, e.target.value))}
          className={fieldClass}
          step={step}
        />
        <span className="text-xs text-[var(--muted)]">–</span>
        <input
          type={type}
          value={(value[keyA] as string | undefined) || ""}
          onChange={(e) => onChange(patch(value, keyA, e.target.value))}
          className={fieldClass}
          step={step}
        />
      </div>
    </div>
  );
}

export function AltriFiltriFormBody({
  value,
  onChange,
  operatori,
  mandanti,
  lotti,
}: {
  value: AltriFiltri;
  onChange: (next: AltriFiltri) => void;
  operatori?: Array<{ id: string; name: string }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
}) {
  return (
    <div className="space-y-5">
      <Sezione title="Filtri anagrafica">
        <Field label="Debitore">
          <input
            value={value.debitore || ""}
            onChange={(e) => onChange(patch(value, "debitore", e.target.value))}
            placeholder="Nome / cognome"
            className={fieldClass}
          />
        </Field>
        <Field label="Città">
          <input
            value={value.citta || ""}
            onChange={(e) => onChange(patch(value, "citta", e.target.value))}
            className={fieldClass}
          />
        </Field>
        <Field label="Prov.">
          <input
            value={value.prov || ""}
            onChange={(e) => onChange(patch(value, "prov", e.target.value))}
            className={fieldClass}
          />
        </Field>
        <Field label="Telefono">
          <input
            value={value.telefono || ""}
            onChange={(e) => onChange(patch(value, "telefono", e.target.value))}
            className={fieldClass}
          />
        </Field>
        <DaA label="CAP da / a" keyDa="capDa" keyA="capA" value={value} onChange={onChange} type="text" />
        <Field label="C.F. / P.IVA">
          <input
            value={value.cfPiva || ""}
            onChange={(e) => onChange(patch(value, "cfPiva", e.target.value))}
            className={fieldClass}
          />
        </Field>
        <Field label="Garante">
          <input
            value={value.garante || ""}
            onChange={(e) => onChange(patch(value, "garante", e.target.value))}
            className={fieldClass}
          />
        </Field>
        <Field label="Note">
          <input
            value={value.note || ""}
            onChange={(e) => onChange(patch(value, "note", e.target.value))}
            className={fieldClass}
          />
        </Field>
      </Sezione>

      <Sezione title="Filtri contabili">
        <DaA
          label="Importo rata da / a"
          keyDa="importoRataDa"
          keyA="importoRataA"
          value={value}
          onChange={onChange}
          type="number"
          step="0.01"
        />
        <DaA
          label="Debito residuo da / a"
          keyDa="residuoDa"
          keyA="residuoA"
          value={value}
          onChange={onChange}
          type="number"
          step="0.01"
        />
        <DaA
          label="Tot. incassato da / a"
          keyDa="totIncassatoDa"
          keyA="totIncassatoA"
          value={value}
          onChange={onChange}
          type="number"
          step="0.01"
        />
        <DaA
          label="Importo totale da / a"
          keyDa="importoTotDa"
          keyA="importoTotA"
          value={value}
          onChange={onChange}
          type="number"
          step="0.01"
        />
        <DaA label="Prom. pag. dal / al" keyDa="promPagDa" keyA="promPagA" value={value} onChange={onChange} />
        <DaA label="Incassato (data) da / a" keyDa="incassatoDa" keyA="incassatoA" value={value} onChange={onChange} />
        <Field label="Rate scadute">
          <select
            value={value.rateScadute || ""}
            onChange={(e) => onChange(patch(value, "rateScadute", e.target.value))}
            className={fieldClass}
          >
            <option value="">Tutte</option>
            <option value="1">Con rate scadute</option>
            <option value="0">Senza rate scadute</option>
          </select>
        </Field>
      </Sezione>

      <Sezione title="Filtri codici e date">
        <Field label="Operatore di affido">
          <select
            value={value.operatore || ""}
            onChange={(e) => onChange(patch(value, "operatore", e.target.value))}
            className={fieldClass}
          >
            <option value="">Tutti</option>
            {(operatori || []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sit. affido">
          <select
            value={value.sitAffido || ""}
            onChange={(e) => onChange(patch(value, "sitAffido", e.target.value))}
            className={fieldClass}
          >
            <option value="">Tutte</option>
            <option value="affidata">Affidata</option>
            <option value="non_affidata">Non affidata</option>
            <option value="temporanea">Affido temporaneo</option>
          </select>
        </Field>
        <Field label="Affido provvisorio">
          <select
            value={value.affidoProvvisorio || ""}
            onChange={(e) => onChange(patch(value, "affidoProvvisorio", e.target.value))}
            className={fieldClass}
          >
            <option value="">No</option>
            <option value="1">Sì (solo temporanei)</option>
          </select>
        </Field>
        <Field label="Mandato">
          <select
            value={value.mandato || ""}
            onChange={(e) => onChange(patch(value, "mandato", e.target.value))}
            className={fieldClass}
          >
            <option value="">Tutti</option>
            {(mandanti || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.codice} — {m.ragioneSociale}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Perimetro / Lotto">
          <select
            value={value.lotto || ""}
            onChange={(e) => onChange(patch(value, "lotto", e.target.value))}
            className={fieldClass}
          >
            <option value="">Tutti</option>
            {(lotti || []).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <DaA label="Data affido da / a" keyDa="affidoDa" keyA="affidoA" value={value} onChange={onChange} />
        <DaA label="Scad. mandato da / a" keyDa="scadenzaDa" keyA="scadenzaA" value={value} onChange={onChange} />
        <Field label="Cod. scarico">
          <select
            value={value.codScarico || ""}
            onChange={(e) => onChange(patch(value, "codScarico", e.target.value))}
            className={fieldClass}
          >
            <option value="">Tutti</option>
            {CODICI_SCARICO.map((c) => (
              <option key={c} value={c}>
                {c} — {CODICE_SCARICO_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <DaA label="N. pratica da / a" keyDa="nPraticaDa" keyA="nPraticaA" value={value} onChange={onChange} type="text" />
        <DaA label="Scarico memo da / a" keyDa="memoDa" keyA="memoA" value={value} onChange={onChange} />
      </Sezione>
    </div>
  );
}
