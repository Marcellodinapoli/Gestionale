"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { METODI_INCASSO } from "@/lib/metodoIncasso";
import {
  emptyPerimetro,
  formToLatoMetodo,
  formToLatoCodice,
  labelSogliaIncentivo,
  labelValoreIncentivo,
  latoMetodoToForm,
  parseOptionalFloat,
  SCAGLIONE_BASE_LABELS,
  codiciScaricoOpzioniScaglione,
  type CodiceScaricoOpzione,
  type CodiceScaricoPerimetro,
  type LatoEconomico,
  type MandantePerimetro,
  type PdrBand,
  type PdrConfigPerimetro,
  type ScaglioneBase,
  type SmsPresetPerimetro,
  type StralcioConfigPerimetro,
  emptyPdrConfig,
  emptyStralcioConfig,
} from "@/lib/mandantePerimetri";

const inputCls = "h-9 w-full rounded border border-[var(--line)] px-2 text-sm";
const smallInputCls = "h-8 w-full rounded border border-[var(--line)] px-2 text-xs";

type ScaglioneForm = {
  id: string;
  base: ScaglioneBase | "";
  codiceScarico: string;
  sogliaPerc: string;
  provvigionePerc: string;
  note: string;
};

type LatoForm = {
  provvPerc: string;
  provvMetodo: Record<string, string>;
  provvCodice: Record<string, string>;
  scaglioni: ScaglioneForm[];
  incentivi: IncentivoForm[];
};

type PdrBandForm = {
  from: string;
  to: string;
  installments: string;
};

type PdrForm = {
  bands: PdrBandForm[];
  minInstallmentAmount: string;
  maxAgePdr: string;
  effettiCambiari: boolean;
  bollettiniPostali: boolean;
};

type StralcioForm = {
  percMin: string;
  percMax: string;
  percProposta: string;
  note: string;
};

type PerimetroForm = {
  id: string;
  /** Acronimo interno (schede cliente). */
  nomeInterno: string;
  descrizione: string;
  nomeMandante: string;
  ricevuta: LatoForm;
  pagata: LatoForm;
  codiciScarico: CodiceScaricoPerimetro[];
  codiciScaricoOperatori: CodiceScaricoPerimetro[];
  smsPreimpostati: SmsPresetPerimetro[];
  pdr: PdrForm;
  stralcio: StralcioForm;
  /** Firma codici scarico all'ultimo salvataggio riuscito del perimetro */
  codiciScaricoSavedSig: string;
};

function codiciSig(codici: CodiceScaricoPerimetro[]) {
  return JSON.stringify(
    [...codici]
      .map((c) => ({
        codice: c.codice.trim().toUpperCase(),
        descrizione: c.descrizione.trim(),
      }))
      .sort((a, b) => a.codice.localeCompare(b.codice))
  );
}

function perimetroProvvigioniUnlocked(p: PerimetroForm) {
  return p.codiciScarico.length > 0 && codiciSig(p.codiciScarico) === p.codiciScaricoSavedSig;
}

type IncentivoForm = {
  id: string;
  valore: string;
  soglia: string;
  note: string;
};

function latoToForm(lato: LatoEconomico): LatoForm {
  const provvigioniCodice = lato.provvigioniCodice ?? {};
  return {
    provvPerc: lato.provvigionePerc != null ? String(lato.provvigionePerc) : "",
    provvMetodo: latoMetodoToForm(lato),
    provvCodice: Object.fromEntries(
      Object.entries(provvigioniCodice).map(([k, v]) => [k, String(v)])
    ),
    scaglioni: lato.scaglioni.map((s) => ({
      id: s.id,
      base: s.base,
      codiceScarico: s.codiceScarico || "",
      sogliaPerc: String(s.sogliaPerc),
      provvigionePerc: String(s.provvigionePerc),
      note: s.note || "",
    })),
    incentivi: lato.incentivi.map((inc) => ({
      id: inc.id,
      valore: String(inc.valore),
      soglia: inc.soglia != null ? String(inc.soglia) : "",
      note: inc.note || "",
    })),
  };
}

function formToIncentivo(form: IncentivoForm) {
  const valore = parseOptionalFloat(form.valore);
  if (valore == null) return null;
  return {
    id: form.id || `inc-${Date.now()}`,
    tipo: "cash" as const,
    valore,
    soglia: parseOptionalFloat(form.soglia),
    note: form.note.trim() || null,
  };
}

function formToScaglione(form: ScaglioneForm) {
  const base = form.base === "incassato" || form.base === "affidato" ? form.base : null;
  const sogliaPerc = parseOptionalFloat(form.sogliaPerc);
  const provvigionePerc = parseOptionalFloat(form.provvigionePerc);
  if (!base || sogliaPerc == null || provvigionePerc == null) return null;
  return {
    id: form.id || `scg-${Date.now()}`,
    base,
    codiceScarico: form.codiceScarico.trim().toUpperCase() || null,
    sogliaPerc,
    provvigionePerc,
    note: form.note.trim() || null,
  };
}

function formToLato(form: LatoForm): LatoEconomico {
  return {
    provvigionePerc: parseOptionalFloat(form.provvPerc),
    provvigioniMetodo: formToLatoMetodo(form.provvMetodo),
    provvigioniCodice: formToLatoCodice(form.provvCodice),
    scaglioni: form.scaglioni
      .map(formToScaglione)
      .filter((x): x is NonNullable<ReturnType<typeof formToScaglione>> => x != null)
      .sort((a, b) => a.sogliaPerc - b.sogliaPerc),
    incentivi: form.incentivi
      .map(formToIncentivo)
      .filter((x): x is NonNullable<ReturnType<typeof formToIncentivo>> => x != null),
  };
}

function normKey(s: string) {
  return s.trim().toLowerCase();
}

/** Acronimo e descrizione devono essere valorizzati, diversi tra loro e unici tra i perimetri. */
function erroreCampiPerimetro(
  acronimo: string,
  descrizione: string,
  items: PerimetroForm[],
  excludeId?: string
): string | null {
  const a = acronimo.trim();
  const d = descrizione.trim();
  if (!a || !d) return "Compila acronimo e descrizione";
  if (normKey(a) === normKey(d)) {
    return "Acronimo e descrizione devono essere diversi";
  }
  const others = items.filter((p) => p.id !== excludeId);
  if (
    others.some(
      (p) =>
        normKey(p.nomeInterno) === normKey(a) ||
        normKey(p.descrizione) === normKey(a) ||
        normKey(p.nomeMandante) === normKey(a)
    )
  ) {
    return "Acronimo già usato su un altro perimetro";
  }
  if (
    others.some(
      (p) =>
        normKey(p.nomeInterno) === normKey(d) ||
        normKey(p.descrizione) === normKey(d) ||
        normKey(p.nomeMandante) === normKey(d)
    )
  ) {
    return "Descrizione già usata su un altro perimetro";
  }
  return null;
}

function pdrToForm(pdr: PdrConfigPerimetro): PdrForm {
  const bands =
    pdr.bands.length > 0
      ? pdr.bands.map((b) => ({
          from: String(b.from),
          to: String(b.to),
          installments: String(b.installments),
        }))
      : [{ from: "", to: "", installments: "" }];
  return {
    bands,
    minInstallmentAmount:
      pdr.minInstallmentAmount != null ? String(pdr.minInstallmentAmount) : "",
    maxAgePdr: pdr.maxAgePdr != null ? String(pdr.maxAgePdr) : "",
    effettiCambiari: pdr.effettiCambiari,
    bollettiniPostali: pdr.bollettiniPostali,
  };
}

function formToPdr(form: PdrForm): PdrConfigPerimetro {
  const bands: PdrBand[] = [];
  for (const row of form.bands) {
    const from = parseOptionalFloat(row.from);
    const to = parseOptionalFloat(row.to);
    const installments = parseOptionalFloat(row.installments);
    if (from == null || to == null || installments == null || installments <= 0) {
      continue;
    }
    bands.push({ from, to, installments: Math.floor(installments) });
  }
  return {
    bands,
    minInstallmentAmount: parseOptionalFloat(form.minInstallmentAmount),
    maxAgePdr: (() => {
      const n = parseOptionalFloat(form.maxAgePdr);
      return n != null ? Math.floor(n) : null;
    })(),
    effettiCambiari: form.effettiCambiari,
    bollettiniPostali: form.bollettiniPostali,
  };
}

function stralcioToForm(s: StralcioConfigPerimetro): StralcioForm {
  return {
    percMin: s.percMin != null ? String(s.percMin) : "",
    percMax: s.percMax != null ? String(s.percMax) : "",
    percProposta: s.percProposta != null ? String(s.percProposta) : "",
    note: s.note ?? "",
  };
}

function formToStralcio(form: StralcioForm): StralcioConfigPerimetro {
  let percMin = parseOptionalFloat(form.percMin);
  let percMax = parseOptionalFloat(form.percMax);
  const percProposta = parseOptionalFloat(form.percProposta);
  const clamp = (n: number | null) =>
    n == null ? null : Math.min(100, Math.max(0, n));
  percMin = clamp(percMin);
  percMax = clamp(percMax);
  if (percMin != null && percMax != null && percMin > percMax) {
    const t = percMin;
    percMin = percMax;
    percMax = t;
  }
  return {
    percMin,
    percMax,
    percProposta: clamp(percProposta),
    note: form.note.trim(),
  };
}

function perimetroToForm(p: MandantePerimetro): PerimetroForm {
  const sig = p.codiciScarico.length > 0 ? codiciSig(p.codiciScarico) : "";
  const descrizione = (p.descrizione || p.nomeMandante || "").trim();
  return {
    id: p.id,
    nomeInterno: p.nomeInterno,
    descrizione,
    nomeMandante: p.nomeMandante || descrizione,
    ricevuta: latoToForm(p.ricevuta),
    pagata: latoToForm(p.pagata),
    codiciScarico: [...p.codiciScarico],
    codiciScaricoOperatori: [...p.codiciScaricoOperatori],
    smsPreimpostati: [...p.smsPreimpostati],
    pdr: pdrToForm(p.pdr ?? emptyPdrConfig()),
    stralcio: stralcioToForm(p.stralcio ?? emptyStralcioConfig()),
    codiciScaricoSavedSig: sig,
  };
}

export function formPerimetriToData(items: PerimetroForm[]): MandantePerimetro[] {
  return items
    .map((p) => {
      const nomeInterno = p.nomeInterno.trim();
      const descrizione = p.descrizione.trim();
      const nomeMandante = (p.nomeMandante.trim() || descrizione).trim();
      if (!nomeInterno || !descrizione) return null;
      if (normKey(nomeInterno) === normKey(descrizione)) return null;
      return {
        id: p.id,
        nomeInterno,
        descrizione,
        nomeMandante,
        ricevuta: formToLato(p.ricevuta),
        pagata: formToLato(p.pagata),
        codiciScarico: p.codiciScarico,
        codiciScaricoOperatori: p.codiciScaricoOperatori,
        smsPreimpostati: p.smsPreimpostati,
        pdr: formToPdr(p.pdr),
        stralcio: formToStralcio(p.stralcio),
      } satisfies MandantePerimetro;
    })
    .filter((p): p is MandantePerimetro => p != null);
}

function cleanLatoCodici(lato: LatoForm, codici: CodiceScaricoPerimetro[]): LatoForm {
  const valid = new Set(codici.map((c) => c.codice.trim().toUpperCase()));
  return {
    ...lato,
    provvCodice: Object.fromEntries(
      Object.entries(lato.provvCodice).filter(([k]) => valid.has(k.trim().toUpperCase()))
    ),
  };
}

function LatoEconomicoEditor({
  title,
  subtitle,
  value,
  onChange,
  codiciScarico,
  codiciScaricoOpzioni,
}: {
  title: string;
  subtitle: string;
  value: LatoForm;
  onChange: (next: LatoForm) => void;
  codiciScarico: CodiceScaricoPerimetro[];
  codiciScaricoOpzioni: CodiceScaricoOpzione[];
}) {
  return (
    <div className="rounded border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-bold uppercase text-[#1a365d]">{title}</p>
      <p className="mb-3 text-[10px] text-[var(--muted)]">{subtitle}</p>

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
          Provvigione default (%)
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={value.provvPerc}
          onChange={(e) => onChange({ ...value, provvPerc: e.target.value })}
          placeholder="es. 8"
          className={`${inputCls} max-w-[120px]`}
        />
      </label>

      <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
        Provvigioni base per codice scarico
      </p>
      <p className="mb-2 text-[10px] text-[var(--muted)]">
        Associa una % diversa dal default a ciascun codice del perimetro. Se
        impostata, sostituisce la provvigione default sulle pratiche con quel
        codice.
      </p>
      {codiciScarico.length > 0 ? (
        <div className="mb-3 overflow-x-auto rounded border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead className="bg-[#eef2f6] text-left text-[10px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-2 py-1.5">Codice</th>
                <th className="px-2 py-1.5">Descrizione</th>
                <th className="w-24 px-2 py-1.5">%</th>
              </tr>
            </thead>
            <tbody>
              {codiciScarico.map((c) => (
                <tr key={c.codice} className="border-t border-[var(--line)]">
                  <td className="px-2 py-1 font-mono text-xs font-bold text-[var(--navy)]">
                    {c.codice}
                  </td>
                  <td className="px-2 py-1 text-xs">{c.descrizione}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={value.provvCodice[c.codice] || ""}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          provvCodice: {
                            ...value.provvCodice,
                            [c.codice]: e.target.value,
                          },
                        })
                      }
                      placeholder={value.provvPerc || "—"}
                      className={smallInputCls}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-3 rounded border border-dashed border-[var(--line)] bg-[#fafbfc] px-2 py-2 text-[10px] text-[var(--muted)]">
          Definisci prima i codici scarico del perimetro per associare provvigioni
          diverse per codice.
        </p>
      )}

      <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
        Provvigioni per modalità incasso
      </p>
      <div className="mb-3 overflow-x-auto rounded border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="bg-[#eef2f6] text-left text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <th className="px-2 py-1.5">Modalità</th>
              <th className="w-24 px-2 py-1.5">%</th>
            </tr>
          </thead>
          <tbody>
            {METODI_INCASSO.map((m) => (
              <tr key={m.value} className="border-t border-[var(--line)]">
                <td className="px-2 py-1 text-xs">{m.label}</td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={value.provvMetodo[m.value] || ""}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        provvMetodo: { ...value.provvMetodo, [m.value]: e.target.value },
                      })
                    }
                    placeholder={value.provvPerc || "—"}
                    className={smallInputCls}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--line)] pt-3">
        <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
          Scaglioni provvigione
        </p>
        <p className="mb-2 text-[10px] text-[var(--muted)]">
          Al superamento della soglia (% su affidato o incassato) la provvigione indicata
          sostituisce quella base. Seleziona un codice scarico del perimetro da considerare
          per il calcolo del raggiungimento.
        </p>
        <div className="space-y-3">
          {value.scaglioni.map((s, i) => (
            <div
              key={s.id}
              className="rounded border border-[var(--line)] bg-[#fafbfc] p-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Scaglione {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      scaglioni: value.scaglioni.filter((_, j) => j !== i),
                    })
                  }
                  className="rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                  title="Rimuovi scaglione"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Base soglia
                  </span>
                  <select
                    value={s.base}
                    onChange={(e) => {
                      const next = [...value.scaglioni];
                      next[i] = {
                        ...next[i]!,
                        base: e.target.value as ScaglioneBase | "",
                      };
                      onChange({ ...value, scaglioni: next });
                    }}
                    className={inputCls}
                  >
                    <option value="">— Seleziona —</option>
                    {(Object.entries(SCAGLIONE_BASE_LABELS) as [ScaglioneBase, string][]).map(
                      ([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Codice obiettivo
                  </span>
                  <select
                    value={s.codiceScarico}
                    onChange={(e) => {
                      const next = [...value.scaglioni];
                      next[i] = { ...next[i]!, codiceScarico: e.target.value };
                      onChange({ ...value, scaglioni: next });
                    }}
                    className={inputCls}
                  >
                    {codiciScaricoOpzioni.map((c) => (
                      <option key={c.value || "tutti"} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Soglia (%)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={s.sogliaPerc}
                    onChange={(e) => {
                      const next = [...value.scaglioni];
                      next[i] = { ...next[i]!, sogliaPerc: e.target.value };
                      onChange({ ...value, scaglioni: next });
                    }}
                    placeholder="es. 30"
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Nuova provvigione (%)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={s.provvigionePerc}
                    onChange={(e) => {
                      const next = [...value.scaglioni];
                      next[i] = { ...next[i]!, provvigionePerc: e.target.value };
                      onChange({ ...value, scaglioni: next });
                    }}
                    placeholder="sostituisce la base"
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Note
                  </span>
                  <textarea
                    value={s.note}
                    onChange={(e) => {
                      const next = [...value.scaglioni];
                      next[i] = { ...next[i]!, note: e.target.value };
                      onChange({ ...value, scaglioni: next });
                    }}
                    rows={2}
                    className="w-full rounded border border-[var(--line)] px-2 py-1 text-sm"
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                scaglioni: [
                  ...value.scaglioni,
                  {
                    id: `scg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    base: "",
                    codiceScarico: "",
                    sogliaPerc: "",
                    provvigionePerc: "",
                    note: "",
                  },
                ],
              })
            }
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            <Plus className="h-3 w-3" /> Aggiungi scaglione
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
          Incentivi cash
        </p>
        <p className="mb-2 text-[10px] text-[var(--muted)]">
          Importo fisso aggiuntivo (non modifica la % provvigione).
        </p>
        <div className="space-y-3">
          {value.incentivi.map((inc, i) => (
            <div
              key={inc.id}
              className="rounded border border-[var(--line)] bg-[#fafbfc] p-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Incentivo cash {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      incentivi: value.incentivi.filter((_, j) => j !== i),
                    })
                  }
                  className="rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                  title="Rimuovi incentivo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    {labelValoreIncentivo("cash")}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inc.valore}
                    onChange={(e) => {
                      const next = [...value.incentivi];
                      next[i] = { ...next[i]!, valore: e.target.value };
                      onChange({ ...value, incentivi: next });
                    }}
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    {labelSogliaIncentivo("cash")}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inc.soglia}
                    onChange={(e) => {
                      const next = [...value.incentivi];
                      next[i] = { ...next[i]!, soglia: e.target.value };
                      onChange({ ...value, incentivi: next });
                    }}
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Note
                  </span>
                  <textarea
                    value={inc.note}
                    onChange={(e) => {
                      const next = [...value.incentivi];
                      next[i] = { ...next[i]!, note: e.target.value };
                      onChange({ ...value, incentivi: next });
                    }}
                    rows={2}
                    className="w-full rounded border border-[var(--line)] px-2 py-1 text-sm"
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                incentivi: [
                  ...value.incentivi,
                  {
                    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    valore: "",
                    soglia: "",
                    note: "",
                  },
                ],
              })
            }
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            <Plus className="h-3 w-3" /> Aggiungi incentivo cash
          </button>
        </div>
      </div>
    </div>
  );
}

function CodiciScaricoPerimetroEditor({
  codici,
  onChange,
  title,
  subtitle,
}: {
  codici: CodiceScaricoPerimetro[];
  onChange: (next: CodiceScaricoPerimetro[]) => void;
  title: string;
  subtitle: string;
}) {
  const [nuovoCodice, setNuovoCodice] = useState("");
  const [nuovaDesc, setNuovaDesc] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editCodice, setEditCodice] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function addCodice() {
    const codice = nuovoCodice.trim().toUpperCase();
    const descrizione = nuovaDesc.trim();
    if (!codice || !descrizione) return;
    if (codici.some((c) => c.codice === codice)) return;
    onChange([...codici, { codice, descrizione }]);
    setNuovoCodice("");
    setNuovaDesc("");
  }

  return (
    <div className="rounded border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-bold uppercase text-[#1a365d]">{title}</p>
      <p className="mb-3 text-[10px] text-[var(--muted)]">{subtitle}</p>
      {codici.length > 0 ? (
        <div className="mb-2 space-y-1">
          {codici.map((c, idx) => (
            <div
              key={c.codice}
              className="flex items-center gap-2 rounded border border-[var(--line)] bg-[#fafbfc] px-2 py-1.5"
            >
              {editingIdx === idx ? (
                <>
                  <input
                    value={editCodice}
                    onChange={(e) => setEditCodice(e.target.value.toUpperCase())}
                    className="h-7 w-20 rounded border border-[var(--line)] px-1.5 text-xs font-mono uppercase"
                  />
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="h-7 min-w-0 flex-1 rounded border border-[var(--line)] px-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const codice = editCodice.trim().toUpperCase();
                      const descrizione = editDesc.trim();
                      if (!codice || !descrizione) return;
                      onChange(
                        codici.map((x, i) => (i === idx ? { codice, descrizione } : x))
                      );
                      setEditingIdx(null);
                    }}
                    className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIdx(null)}
                    className="shrink-0 rounded p-1 text-[var(--muted)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="w-16 shrink-0 font-mono text-xs font-bold text-[var(--navy)]">
                    {c.codice}
                  </span>
                  <span className="min-w-0 flex-1 text-xs">{c.descrizione}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIdx(idx);
                      setEditCodice(c.codice);
                      setEditDesc(c.descrizione);
                    }}
                    className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#eef4f8]"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(codici.filter((_, i) => i !== idx))}
                    className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-xs text-[var(--muted)]">Nessun codice scarico definito.</p>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-[var(--line)] p-2">
        <input
          value={nuovoCodice}
          onChange={(e) => setNuovoCodice(e.target.value.toUpperCase())}
          placeholder="Codice (es. PTC)"
          className="h-8 w-24 rounded border border-[var(--line)] px-2 font-mono text-xs uppercase"
        />
        <input
          value={nuovaDesc}
          onChange={(e) => setNuovaDesc(e.target.value)}
          placeholder="Descrizione"
          className="h-8 min-w-[160px] flex-1 rounded border border-[var(--line)] px-2 text-xs"
        />
        <button
          type="button"
          onClick={addCodice}
          disabled={!nuovoCodice.trim() || !nuovaDesc.trim()}
          className="flex h-8 items-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Aggiungi
        </button>
      </div>
    </div>
  );
}

function isPdrRowComplete(row: PdrBandForm) {
  const from = parseOptionalFloat(row.from);
  const to = parseOptionalFloat(row.to);
  const installments = parseOptionalFloat(row.installments);
  return from != null && to != null && installments != null && installments > 0;
}

function isPdrRowStarted(row: PdrBandForm) {
  return Boolean(row.from.trim() || row.to.trim() || row.installments.trim());
}

function PdrPerimetroEditor({
  value,
  onChange,
}: {
  value: PdrForm;
  onChange: (next: PdrForm) => void;
}) {
  function updateBand(index: number, patch: Partial<PdrBandForm>) {
    const bands = value.bands.map((b, i) => (i === index ? { ...b, ...patch } : b));
    if (patch.to != null && index < bands.length - 1) {
      const to = parseOptionalFloat(patch.to);
      if (to != null) {
        bands[index + 1] = {
          ...bands[index + 1]!,
          from: String(to + 1),
        };
      }
    }
    onChange({ ...value, bands });
  }

  function addBand() {
    const last = value.bands[value.bands.length - 1];
    if (!last || !isPdrRowComplete(last)) return;
    const to = parseOptionalFloat(last.to);
    if (to == null) return;
    onChange({
      ...value,
      bands: [...value.bands, { from: String(to + 1), to: "", installments: "" }],
    });
  }

  function removeBand(index: number) {
    if (index <= 0 || value.bands.length <= 1) return;
    onChange({
      ...value,
      bands: value.bands.filter((_, i) => i !== index),
    });
  }

  const firstStarted = value.bands[0] ? isPdrRowStarted(value.bands[0]) : false;

  return (
    <div className="rounded border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-bold uppercase text-[#1a365d]">
        Dati per il PDR (piano di rientro)
      </p>
      <p className="mb-3 text-[10px] text-[var(--muted)]">
        Fasce importo netto → rate massime (come CreditCalc). Se non compilate, in
        pratica non sarà possibile creare un piano di rientro.
      </p>
      <div className="space-y-2">
        {value.bands.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <label className="min-w-[100px] flex-1 text-[10px]">
              <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
                Da valore min.
              </span>
              <input
                type="number"
                min={0}
                step="1"
                value={row.from}
                readOnly={index > 0}
                onChange={(e) => updateBand(index, { from: e.target.value })}
                className={`${smallInputCls} ${index > 0 ? "bg-[#f4f7fa]" : ""}`}
              />
            </label>
            <label className="min-w-[100px] flex-1 text-[10px]">
              <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
                A valore max.
              </span>
              <input
                type="number"
                min={0}
                step="1"
                value={row.to}
                onChange={(e) => updateBand(index, { to: e.target.value })}
                className={smallInputCls}
              />
            </label>
            <label className="min-w-[90px] flex-1 text-[10px]">
              <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
                Rate previste
              </span>
              <input
                type="number"
                min={1}
                step="1"
                value={row.installments}
                onChange={(e) => updateBand(index, { installments: e.target.value })}
                className={smallInputCls}
              />
            </label>
            {index > 0 ? (
              <button
                type="button"
                onClick={() => removeBand(index)}
                className="mb-0.5 rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                title="Rimuovi fascia"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addBand}
        disabled={!isPdrRowComplete(value.bands[value.bands.length - 1] ?? { from: "", to: "", installments: "" })}
        className="mt-2 flex h-8 items-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
      >
        <Plus className="h-3 w-3" /> Aggiungi fascia PDR
      </button>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[10px]">
          <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
            Importo minimo rata/effetto {firstStarted ? "*" : ""}
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={value.minInstallmentAmount}
            onChange={(e) =>
              onChange({ ...value, minInstallmentAmount: e.target.value })
            }
            className={smallInputCls}
            placeholder="es. 50"
          />
        </label>
        <label className="text-[10px]">
          <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
            Età massima PDR
          </span>
          <input
            type="number"
            min={0}
            step="1"
            value={value.maxAgePdr}
            onChange={(e) => onChange({ ...value, maxAgePdr: e.target.value })}
            className={smallInputCls}
            placeholder="es. 75"
          />
        </label>
      </div>
      <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-[var(--muted)]">
        {firstStarted ? "* " : ""}Modalità di pagamento per il rateizzo
      </p>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <input type="checkbox" checked disabled className="rounded" />
          Contanti
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={value.effettiCambiari}
            onChange={(e) =>
              onChange({ ...value, effettiCambiari: e.target.checked })
            }
            className="rounded"
          />
          Effetti cambiari
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={value.bollettiniPostali}
            onChange={(e) =>
              onChange({ ...value, bollettiniPostali: e.target.checked })
            }
            className="rounded"
          />
          Bollettini postali
        </label>
      </div>
    </div>
  );
}

function StralcioPerimetroEditor({
  value,
  onChange,
}: {
  value: StralcioForm;
  onChange: (next: StralcioForm) => void;
}) {
  return (
    <div className="rounded border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-bold uppercase text-[#1a365d]">
        Dati per il saldo a stralcio
      </p>
      <p className="mb-3 text-[10px] text-[var(--muted)]">
        Percentuale di stralcio sul debito (come CreditCalc). Se lasciate vuote,
        l&apos;operatore negozia liberamente in pratica.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[10px]">
          <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
            % stralcio minima
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            value={value.percMin}
            onChange={(e) => onChange({ ...value, percMin: e.target.value })}
            className={smallInputCls}
            placeholder="es. 10"
          />
        </label>
        <label className="text-[10px]">
          <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
            % stralcio massima
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            value={value.percMax}
            onChange={(e) => onChange({ ...value, percMax: e.target.value })}
            className={smallInputCls}
            placeholder="es. 40"
          />
        </label>
        <label className="text-[10px]">
          <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
            % stralcio proposta
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            value={value.percProposta}
            onChange={(e) => onChange({ ...value, percProposta: e.target.value })}
            className={smallInputCls}
            placeholder="es. 25"
          />
        </label>
      </div>
      <label className="mt-2 block text-[10px]">
        <span className="mb-0.5 block font-semibold uppercase text-[var(--muted)]">
          Note / istruzioni mandante
        </span>
        <textarea
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          rows={2}
          className="w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs"
          placeholder="es. oltre il 30% richiede autorizzazione mandante"
        />
      </label>
    </div>
  );
}

function SmsPerimetroEditor({
  sms,
  onChange,
}: {
  sms: SmsPresetPerimetro[];
  onChange: (next: SmsPresetPerimetro[]) => void;
}) {
  const [nuovoTitolo, setNuovoTitolo] = useState("");
  const [nuovoTesto, setNuovoTesto] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editTitolo, setEditTitolo] = useState("");
  const [editTesto, setEditTesto] = useState("");

  function addSms() {
    const titolo = nuovoTitolo.trim();
    const testo = nuovoTesto.trim();
    if (!titolo || !testo) return;
    onChange([...sms, { id: `sms-${Date.now()}`, titolo, testo }]);
    setNuovoTitolo("");
    setNuovoTesto("");
  }

  return (
    <div className="rounded border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-bold uppercase text-[#1a365d]">Messaggi SMS preimpostati</p>
      <p className="mb-3 text-[10px] text-[var(--muted)]">
        Messaggi SMS disponibili sulle pratiche di questo perimetro.
      </p>
      {sms.length > 0 ? (
        <div className="mb-2 space-y-1.5">
          {sms.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-start gap-2 rounded border border-[var(--line)] bg-[#fafbfc] p-2"
            >
              {editingIdx === idx ? (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={editTitolo}
                    onChange={(e) => setEditTitolo(e.target.value)}
                    className="h-7 w-full rounded border border-[var(--line)] px-1.5 text-xs font-semibold"
                  />
                  <textarea
                    value={editTesto}
                    onChange={(e) => setEditTesto(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-[var(--line)] px-1.5 py-1 text-[10px]"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const titolo = editTitolo.trim();
                        const testo = editTesto.trim();
                        if (!titolo || !testo) return;
                        onChange(sms.map((s, i) => (i === idx ? { ...s, titolo, testo } : s)));
                        setEditingIdx(null);
                      }}
                      className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIdx(null)}
                      className="rounded p-1 text-[var(--muted)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--navy)]">{item.titolo}</p>
                    <p className="text-[10px] text-[var(--muted)]">{item.testo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIdx(idx);
                      setEditTitolo(item.titolo);
                      setEditTesto(item.testo);
                    }}
                    className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#eef4f8]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(sms.filter((s) => s.id !== item.id))}
                    className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 rounded border border-dashed border-[var(--line)] p-2 sm:grid-cols-[1fr_2fr_auto]">
        <input
          value={nuovoTitolo}
          onChange={(e) => setNuovoTitolo(e.target.value)}
          placeholder="Titolo"
          className="h-8 rounded border border-[var(--line)] px-2 text-xs"
        />
        <input
          value={nuovoTesto}
          onChange={(e) => setNuovoTesto(e.target.value)}
          placeholder="Testo del messaggio..."
          className="h-8 rounded border border-[var(--line)] px-2 text-xs"
        />
        <button
          type="button"
          onClick={addSms}
          disabled={!nuovoTitolo.trim() || !nuovoTesto.trim()}
          className="flex h-8 items-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Aggiungi
        </button>
      </div>
    </div>
  );
}

export function PerimetriMandanteSection({
  initial,
  onChange,
  canCreatePerimetro = true,
  savedRevision = 0,
  mandanteFormId = "mandante-scheda-form",
  isSaving = false,
  isNew = false,
}: {
  initial: MandantePerimetro[];
  onChange: (items: MandantePerimetro[]) => void;
  /** false finché anagrafica mandante (ragione sociale + acronimo interno) non è compilata */
  canCreatePerimetro?: boolean;
  /** Incrementato dal genitore dopo ogni salvataggio riuscito */
  savedRevision?: number;
  mandanteFormId?: string;
  isSaving?: boolean;
  isNew?: boolean;
}) {
  const [items, setItems] = useState<PerimetroForm[]>(() =>
    initial.length ? initial.map((p) => perimetroToForm(p)) : []
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [activePerimetroId, setActivePerimetroId] = useState<string | null>(null);
  const [nuovoAcronimo, setNuovoAcronimo] = useState("");
  const [nuovaDescrizione, setNuovaDescrizione] = useState("");
  const [nuovoErrore, setNuovoErrore] = useState<string | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(formPerimetriToData(itemsRef.current));
  }, []);

  useEffect(() => {
    if (savedRevision <= 0) return;
    const next = itemsRef.current.map((p) => {
      if (p.codiciScarico.length === 0) return p;
      return {
        ...p,
        codiciScaricoSavedSig: codiciSig(p.codiciScarico),
      };
    });
    itemsRef.current = next;
    setItems(next);
  }, [savedRevision]);

  function pushToParent(next: PerimetroForm[]) {
    onChangeRef.current(formPerimetriToData(next));
  }

  function commit(updater: (prev: PerimetroForm[]) => PerimetroForm[]) {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
    pushToParent(next);
  }

  function addPerimetro() {
    if (!canCreatePerimetro) return;
    const acronimo = nuovoAcronimo.trim().toUpperCase();
    const descrizione = nuovaDescrizione.trim();
    const err = erroreCampiPerimetro(acronimo, descrizione, items);
    if (err) {
      setNuovoErrore(err);
      return;
    }
    const newItem = perimetroToForm(emptyPerimetro(acronimo, descrizione));
    commit((prev) => [...prev, newItem]);
    setActivePerimetroId(newItem.id);
    setNuovoAcronimo("");
    setNuovaDescrizione("");
    setNuovoErrore(null);
  }

  function togglePerimetro(id: string) {
    setActivePerimetroId((cur) => (cur === id ? null : id));
  }

  function removePerimetro(id: string) {
    commit((prev) => prev.filter((p) => p.id !== id));
    setActivePerimetroId((cur) => (cur === id ? null : cur));
  }

  function updatePerimetro(id: string, patch: Partial<PerimetroForm>) {
    commit((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        return next;
      })
    );
  }

  const erroreNuovo =
    nuovoErrore ||
    (nuovoAcronimo.trim() && nuovaDescrizione.trim()
      ? erroreCampiPerimetro(nuovoAcronimo, nuovaDescrizione, items)
      : null);

  const perimetriPendingCodiciSave = items.filter(
    (p) => p.codiciScarico.length > 0 && !perimetroProvvigioniUnlocked(p)
  );

  return (
    <div className="space-y-3 p-3">
      <p className="text-[10px] text-[var(--muted)]">
        Ogni perimetro ha un <strong>acronimo interno</strong> (visibile nelle schede cliente) e
        una <strong>descrizione</strong>: devono essere diversi tra loro e non ripetersi sugli
        altri perimetri. Definisci prima i codici scarico, poi configura provvigioni e messaggi SMS.
      </p>
      {!canCreatePerimetro ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          Compila <strong>ragione sociale</strong> e <strong>acronimo interno</strong> mandante prima di
          aggiungere un perimetro.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nessun perimetro definito.</p>
      ) : (
        <div className="space-y-3">
          {items.map((p) => {
            const expanded = activePerimetroId === p.id;
            return (
            <div key={p.id} className="rounded-lg border border-[var(--line)] bg-[#fafbfc]">
              <div className="flex items-center gap-2 bg-[#eef2f6] px-2 py-2">
                <button
                  type="button"
                  onClick={() => togglePerimetro(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left hover:opacity-80"
                  title={expanded ? "Chiudi perimetro" : "Apri perimetro"}
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--navy)] transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                  <span className="text-sm font-semibold text-[var(--navy)]">
                    {p.nomeInterno.trim() || "—"}
                    {p.descrizione.trim() ? (
                      <>
                        <span className="mx-1.5 font-normal text-[var(--muted)]">·</span>
                        <span className="font-normal text-[var(--muted)]">
                          {p.descrizione.trim()}
                        </span>
                      </>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removePerimetro(p.id)}
                  className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                  title="Elimina perimetro"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {expanded ? (
                <div className="border-b border-[var(--line)] bg-[#eef2f6] px-2 pb-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[120px] flex-1 text-xs">
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                        Acronimo perimetro
                      </span>
                      <input
                        value={p.nomeInterno}
                        onChange={(e) =>
                          updatePerimetro(p.id, {
                            nomeInterno: e.target.value.toUpperCase(),
                          })
                        }
                        className="h-8 w-full rounded border border-[var(--line)] bg-white px-2 text-sm font-semibold text-[var(--navy)]"
                        placeholder="es. DIS"
                      />
                    </label>
                    <label className="min-w-[180px] flex-[2] text-xs">
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                        Descrizione perimetro
                      </span>
                      <input
                        value={p.descrizione}
                        onChange={(e) => {
                          const descrizione = e.target.value;
                          updatePerimetro(p.id, {
                            descrizione,
                            nomeMandante: descrizione,
                          });
                        }}
                        className="h-8 w-full rounded border border-[var(--line)] bg-white px-2 text-sm font-semibold text-[var(--navy)]"
                        placeholder="es. Disattivazione"
                      />
                    </label>
                  </div>
                  {(() => {
                    const errEdit = erroreCampiPerimetro(
                      p.nomeInterno,
                      p.descrizione,
                      items,
                      p.id
                    );
                    return errEdit ? (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-700">
                        {errEdit}
                      </p>
                    ) : null;
                  })()}
                </div>
              ) : null}
              {expanded ? (
                <div className="space-y-3 p-3">
                  <CodiciScaricoPerimetroEditor
                    title="Codici scarico back office"
                    subtitle="Codici usati dal back office per provvigioni base, scaglioni e statistiche."
                    codici={p.codiciScarico}
                    onChange={(codiciScarico) =>
                      updatePerimetro(p.id, {
                        codiciScarico,
                        ricevuta: cleanLatoCodici(p.ricevuta, codiciScarico),
                        pagata: cleanLatoCodici(p.pagata, codiciScarico),
                      })
                    }
                  />
                  <CodiciScaricoPerimetroEditor
                    title="Codici scarico operatori"
                    subtitle="Codici selezionabili dagli operatori in lavorazione sulle pratiche di questo perimetro."
                    codici={p.codiciScaricoOperatori}
                    onChange={(codiciScaricoOperatori) =>
                      updatePerimetro(p.id, { codiciScaricoOperatori })
                    }
                  />
                  <PdrPerimetroEditor
                    value={p.pdr}
                    onChange={(pdr) => updatePerimetro(p.id, { pdr })}
                  />
                  <StralcioPerimetroEditor
                    value={p.stralcio}
                    onChange={(stralcio) => updatePerimetro(p.id, { stralcio })}
                  />
                  {p.codiciScarico.length > 0 && !perimetroProvvigioniUnlocked(p) ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                      <p className="text-sm font-semibold text-amber-950">
                        Salva per continuare
                      </p>
                      <p className="mt-1 text-xs text-amber-900">
                        Hai creato o modificato i codici scarico. Salva la mandante per
                        sbloccare provvigioni, scaglioni e messaggi SMS con i codici
                        appena definiti.
                      </p>
                      <button
                        type="submit"
                        form={mandanteFormId}
                        disabled={isSaving || (isNew && !canCreatePerimetro)}
                        className="mt-3 flex h-9 items-center rounded-lg bg-[var(--navy)] px-4 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {isSaving
                          ? "Salvataggio..."
                          : isNew
                            ? "Crea mandante e continua"
                            : "Salva e continua"}
                      </button>
                    </div>
                  ) : null}
                  {perimetroProvvigioniUnlocked(p) ? (
                    <>
                  {(() => {
                    const codiciOpzioni = codiciScaricoOpzioniScaglione(p.codiciScarico);
                    return (
                      <>
                        <LatoEconomicoEditor
                          title="Provvigioni dalla mandante"
                          subtitle="Ciò che la mandante paga all'agenzia su questo perimetro."
                          value={p.ricevuta}
                          onChange={(ricevuta) => updatePerimetro(p.id, { ricevuta })}
                          codiciScarico={p.codiciScarico}
                          codiciScaricoOpzioni={codiciOpzioni}
                        />
                        <LatoEconomicoEditor
                          title="Provvigioni ai collaboratori"
                          subtitle="Ciò che l'agenzia paga ai dipendenti su questo perimetro."
                          value={p.pagata}
                          onChange={(pagata) => updatePerimetro(p.id, { pagata })}
                          codiciScarico={p.codiciScarico}
                          codiciScaricoOpzioni={codiciOpzioni}
                        />
                      </>
                    );
                  })()}
                  <SmsPerimetroEditor
                    sms={p.smsPreimpostati}
                    onChange={(smsPreimpostati) => updatePerimetro(p.id, { smsPreimpostati })}
                  />
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      )}

      {perimetriPendingCodiciSave.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-sm font-semibold text-amber-950">
            {perimetriPendingCodiciSave.length === 1
              ? "1 perimetro in attesa di salvataggio"
              : `${perimetriPendingCodiciSave.length} perimetri in attesa di salvataggio`}
          </p>
          <p className="mt-1 text-xs text-amber-900">
            Salva la mandante per sbloccare provvigioni e SMS sui perimetri con codici
            scarico appena creati o modificati.
          </p>
          <button
            type="submit"
            form={mandanteFormId}
            disabled={isSaving || (isNew && !canCreatePerimetro)}
            className="mt-3 flex h-9 items-center rounded-lg bg-[var(--navy)] px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isSaving
              ? "Salvataggio..."
              : isNew
                ? "Crea mandante e continua"
                : "Salva e continua"}
          </button>
        </div>
      ) : null}

      <div className="rounded border border-dashed border-[var(--accent)] bg-white p-2">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
          <label className="text-xs">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
              Acronimo perimetro
            </span>
            <input
              value={nuovoAcronimo}
              onChange={(e) => {
                setNuovoAcronimo(e.target.value.toUpperCase());
                setNuovoErrore(null);
              }}
              placeholder="es. DIS"
              disabled={!canCreatePerimetro}
              className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs disabled:bg-[#eef2f6] disabled:text-[var(--muted)]"
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
              Descrizione perimetro
            </span>
            <input
              value={nuovaDescrizione}
              onChange={(e) => {
                setNuovaDescrizione(e.target.value);
                setNuovoErrore(null);
              }}
              placeholder="es. Disattivazione"
              disabled={!canCreatePerimetro}
              className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs disabled:bg-[#eef2f6] disabled:text-[var(--muted)]"
            />
          </label>
          <button
            type="button"
            onClick={addPerimetro}
            disabled={
              !canCreatePerimetro ||
              !nuovoAcronimo.trim() ||
              !nuovaDescrizione.trim() ||
              Boolean(erroreNuovo)
            }
            className="flex h-8 items-center justify-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Aggiungi perimetro
          </button>
        </div>
        {erroreNuovo ? (
          <p className="mt-1.5 text-[11px] font-medium text-rose-700">{erroreNuovo}</p>
        ) : null}
      </div>
    </div>
  );
}
