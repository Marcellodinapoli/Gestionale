"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";
import { CodScaricoFiltroControls } from "@/components/filtri/CodScaricoFiltroControls";
import { OperatoreFiltroControls } from "@/components/filtri/OperatoreFiltroControls";
import { AggiuntivoFiltroControls } from "@/components/filtri/AggiuntivoFiltroControls";
import { joinCodScaricoList } from "@/lib/filtriCodScarico";
import { joinOperatoreList } from "@/lib/filtriOperatore";
import {
  codiciScaricoFiltroDisponibili,
  type MandantePerimetriRef,
} from "@/lib/filtriCodScaricoPerimetro";
import {
  lottoFiltroOptions,
  perimetroFiltroOptions,
} from "@/lib/filtriPerimetroLottoUi";
import { TextFiltroControls } from "@/components/filtri/TextFiltroControls";
import { FILTRI_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";
import { SelectFiltroControls } from "@/components/filtri/SelectFiltroControls";
import { TEXT_FILTER_DEFAULT } from "@/lib/filtriTestoOp";
import type { SelectFilterField, SelectFilterOpKey, TextFilterField, TextFilterOpKey } from "@/lib/filtriTestoOp";

const fieldClass = FILTRI_FIELD_CLASS;
const labelClass = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Sezione({
  title,
  tone = "anagrafica",
  children,
}: {
  title: string;
  tone?: "anagrafica" | "contabili" | "codici";
  children: ReactNode;
}) {
  const bg =
    tone === "anagrafica"
      ? "bg-[#e8f1f7]"
      : tone === "contabili"
        ? "bg-[#eaf4ec]"
        : "bg-[#f5efe6]";
  return (
    <section className={`space-y-2 rounded-lg border border-[var(--line)]/70 ${bg} p-3`}>
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

function TextFiltroField({
  label,
  field,
  opKey,
  value,
  onChange,
  placeholder,
  inputType = "text",
}: {
  label: string;
  field: TextFilterField;
  opKey: TextFilterOpKey;
  value: AltriFiltri;
  onChange: (next: AltriFiltri) => void;
  placeholder?: string;
  inputType?: "text" | "search" | "tel";
}) {
  return (
    <Field label={label}>
      <TextFiltroControls
        value={value[field] || ""}
        op={value[opKey]}
        fieldClass={fieldClass}
        placeholder={placeholder}
        inputType={inputType}
        onValueChange={(v) => {
          const next = { ...value };
          if (v) {
            next[field] = v;
            if (!next[opKey]) next[opKey] = TEXT_FILTER_DEFAULT;
          } else {
            delete next[field];
            delete next[opKey];
          }
          onChange(next);
        }}
        onOpChange={(op) => onChange({ ...value, [opKey]: op })}
      />
    </Field>
  );
}

function SelectFiltroField({
  label,
  field,
  opKey,
  value,
  onChange,
  ariaLabel,
  children,
}: {
  label: string;
  field: SelectFilterField;
  opKey: SelectFilterOpKey;
  value: AltriFiltri;
  onChange: (next: AltriFiltri) => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <Field label={label}>
      <SelectFiltroControls
        op={value[opKey]}
        value={value[field] || ""}
        fieldClass={fieldClass}
        ariaLabel={ariaLabel}
        onOpChange={(op) => onChange({ ...value, [opKey]: op })}
        onValueChange={(v) => {
          const next = { ...value };
          if (v) {
            next[field] = v as never;
            if (!next[opKey]) next[opKey] = TEXT_FILTER_DEFAULT;
          } else {
            delete next[field];
            delete next[opKey];
          }
          onChange(next);
        }}
      >
        {children}
      </SelectFiltroControls>
    </Field>
  );
}

export function AltriFiltriFormBody({
  value,
  onChange,
  operatori,
  mandanti,
  lotti,
  lottiPerMandato,
  mandantiPerimetri,
}: {
  value: AltriFiltri;
  onChange: (next: AltriFiltri) => void;
  operatori?: Array<{ id: string; name: string; acronimo?: string | null }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
  lottiPerMandato?: Record<string, string[]>;
  mandantiPerimetri?: MandantePerimetriRef[];
}) {
  const perimetriOpts = useMemo(
    () => perimetroFiltroOptions(mandantiPerimetri, value.mandato),
    [mandantiPerimetri, value.mandato]
  );
  const lottiOpts = useMemo(
    () => lottoFiltroOptions(lotti, lottiPerMandato, value.mandato),
    [lotti, lottiPerMandato, value.mandato]
  );
  const codiciScaricoOpts = useMemo(
    () => codiciScaricoFiltroDisponibili(mandantiPerimetri, value.mandato, value.perimetro),
    [mandantiPerimetri, value.mandato, value.perimetro]
  );

  return (
    <div className="space-y-5">
      <Sezione title="Filtri anagrafica" tone="anagrafica">
        <TextFiltroField
          label="Debitore"
          field="debitore"
          opKey="debitoreOp"
          value={value}
          onChange={onChange}
          placeholder="Nome / cognome"
        />
        <TextFiltroField
          label="Città"
          field="citta"
          opKey="cittaOp"
          value={value}
          onChange={onChange}
          placeholder="Città debitore"
        />
        <TextFiltroField
          label="Prov."
          field="prov"
          opKey="provOp"
          value={value}
          onChange={onChange}
          placeholder="Provincia"
        />
        <TextFiltroField
          label="Telefono"
          field="telefono"
          opKey="telefonoOp"
          value={value}
          onChange={onChange}
          placeholder="Telefono"
          inputType="tel"
        />
        <DaA label="CAP da / a" keyDa="capDa" keyA="capA" value={value} onChange={onChange} type="text" />
        <TextFiltroField
          label="C.F. / P.IVA"
          field="cfPiva"
          opKey="cfPivaOp"
          value={value}
          onChange={onChange}
          placeholder="Codice fiscale"
        />
        <TextFiltroField
          label="Garante"
          field="garante"
          opKey="garanteOp"
          value={value}
          onChange={onChange}
          placeholder="Nome / CF garante"
        />
        <TextFiltroField
          label="Note"
          field="note"
          opKey="noteOp"
          value={value}
          onChange={onChange}
          placeholder="Testo in note / attività"
        />
      </Sezione>

      <Sezione title="Filtri contabili" tone="contabili">
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

      <Sezione title="Filtri codici e date" tone="codici">
        <Field label="Cod. operatore">
          <OperatoreFiltroControls
            operatore={value.operatore}
            operatoreOp={value.operatoreOp}
            fieldClass={fieldClass}
            operatori={operatori || []}
            disabled={!operatori?.length}
            onOperatoreOpChange={(op) => onChange({ ...value, operatoreOp: op })}
            onOperatoreChange={(ids) => {
              const next = { ...value };
              if (ids.length) {
                next.operatore = joinOperatoreList(ids);
                if (!next.operatoreOp) next.operatoreOp = "eq";
              } else {
                delete next.operatore;
                delete next.operatoreOp;
              }
              onChange(next);
            }}
          />
        </Field>
        <SelectFiltroField
          label="Sit. affido"
          field="sitAffido"
          opKey="sitAffidoOp"
          value={value}
          onChange={onChange}
          ariaLabel="Sit. affido"
        >
          <option value="">Tutte</option>
          <option value="affidata">Affidata</option>
          <option value="non_affidata">Non affidata</option>
          <option value="temporanea">Affido temporaneo</option>
        </SelectFiltroField>
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
        <SelectFiltroField
          label="Mandato"
          field="mandato"
          opKey="mandatoOp"
          value={value}
          onChange={onChange}
          ariaLabel="Mandato"
        >
          <option value="">Tutti</option>
          {(mandanti || []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.codice} — {m.ragioneSociale}
            </option>
          ))}
        </SelectFiltroField>
        <SelectFiltroField
          label="Perimetro"
          field="perimetro"
          opKey="perimetroOp"
          value={value}
          onChange={onChange}
          ariaLabel="Perimetro"
        >
          <option value="">Tutti</option>
          {perimetriOpts.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          {value.perimetro &&
          !perimetriOpts.some((p) => p.value === value.perimetro) ? (
            <option value={value.perimetro}>{value.perimetro} (chiuso)</option>
          ) : null}
        </SelectFiltroField>
        <SelectFiltroField
          label="Lotto"
          field="lotto"
          opKey="lottoOp"
          value={value}
          onChange={onChange}
          ariaLabel="Lotto"
        >
          <option value="">Tutti</option>
          {lottiOpts.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
          {value.lotto && !lottiOpts.includes(value.lotto) ? (
            <option value={value.lotto}>{value.lotto} (chiuso)</option>
          ) : null}
        </SelectFiltroField>
        <DaA label="Data affido da / a" keyDa="affidoDa" keyA="affidoA" value={value} onChange={onChange} />
        <DaA label="Scad. mandato da / a" keyDa="scadenzaDa" keyA="scadenzaA" value={value} onChange={onChange} />
        <Field label="Cod. scarico">
          <CodScaricoFiltroControls
            codScarico={value.codScarico}
            codScaricoOp={value.codScaricoOp}
            fieldClass={fieldClass}
            mandatoId={value.mandato}
            codiciDisponibili={codiciScaricoOpts}
            onCodScaricoOpChange={(op) =>
              onChange({ ...value, codScaricoOp: op })
            }
            onCodScaricoChange={(codes) => {
              const next = { ...value };
              if (codes.length) {
                next.codScarico = joinCodScaricoList(codes);
                if (!next.codScaricoOp) next.codScaricoOp = "eq";
              } else {
                delete next.codScarico;
                delete next.codScaricoOp;
              }
              onChange(next);
            }}
          />
        </Field>
        <DaA label="N. pratica da / a" keyDa="nPraticaDa" keyA="nPraticaA" value={value} onChange={onChange} type="text" />
        <DaA label="Scarico memo da / a" keyDa="memoDa" keyA="memoA" value={value} onChange={onChange} />
        <Field label="Aggiuntivo">
          <AggiuntivoFiltroControls
            campo={value.aggiuntivoCampo}
            valore={value.aggiuntivoValore}
            op={value.aggiuntivoOp || TEXT_FILTER_DEFAULT}
            fieldClass={fieldClass}
            onOpChange={(op) => onChange({ ...value, aggiuntivoOp: op })}
            onCampoChange={(campo) => {
              const next = { ...value };
              if (campo) {
                next.aggiuntivoCampo = campo;
                if (!next.aggiuntivoOp) next.aggiuntivoOp = TEXT_FILTER_DEFAULT;
              } else {
                delete next.aggiuntivoCampo;
                delete next.aggiuntivoValore;
                delete next.aggiuntivoOp;
              }
              onChange(next);
            }}
            onValoreChange={(valore) => {
              const next = { ...value };
              if (valore.trim()) {
                next.aggiuntivoValore = valore;
                if (!next.aggiuntivoOp) next.aggiuntivoOp = TEXT_FILTER_DEFAULT;
              } else {
                delete next.aggiuntivoValore;
              }
              onChange(next);
            }}
          />
        </Field>
      </Sezione>
    </div>
  );
}
