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
  type ScaglioneBase,
  type SmsPresetPerimetro,
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

type PerimetroForm = {
  id: string;
  nomeInterno: string;
  nomeMandante: string;
  ricevuta: LatoForm;
  pagata: LatoForm;
  codiciScarico: CodiceScaricoPerimetro[];
  smsPreimpostati: SmsPresetPerimetro[];
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

function perimetroToForm(p: MandantePerimetro): PerimetroForm {
  const sig = p.codiciScarico.length > 0 ? codiciSig(p.codiciScarico) : "";
  return {
    id: p.id,
    nomeInterno: p.nomeInterno,
    nomeMandante: p.nomeMandante,
    ricevuta: latoToForm(p.ricevuta),
    pagata: latoToForm(p.pagata),
    codiciScarico: [...p.codiciScarico],
    smsPreimpostati: [...p.smsPreimpostati],
    codiciScaricoSavedSig: sig,
  };
}

export function formPerimetriToData(items: PerimetroForm[]): MandantePerimetro[] {
  return items
    .map((p) => {
      const nomeInterno = p.nomeInterno.trim();
      const nomeMandante = p.nomeMandante.trim();
      if (!nomeInterno || !nomeMandante) return null;
      return {
        id: p.id,
        nomeInterno,
        nomeMandante,
        ricevuta: formToLato(p.ricevuta),
        pagata: formToLato(p.pagata),
        codiciScarico: p.codiciScarico,
        smsPreimpostati: p.smsPreimpostati,
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
}: {
  codici: CodiceScaricoPerimetro[];
  onChange: (next: CodiceScaricoPerimetro[]) => void;
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
      <p className="text-xs font-bold uppercase text-[#1a365d]">Codici scarico</p>
      <p className="mb-3 text-[10px] text-[var(--muted)]">
        Crea i codici scarico di questo perimetro: servono per associare le
        provvigioni base e per configurare gli scaglioni.
      </p>
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
                    onChange={(e) => setEditCodice(e.target.value)}
                    className="h-7 w-20 rounded border border-[var(--line)] px-1.5 text-xs font-mono"
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
          onChange={(e) => setNuovoCodice(e.target.value)}
          placeholder="Codice (es. PTC)"
          className="h-8 w-24 rounded border border-[var(--line)] px-2 font-mono text-xs"
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
  const [nuovoInterno, setNuovoInterno] = useState("");
  const [nuovoMandante, setNuovoMandante] = useState("");

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
    const nomeInterno = nuovoInterno.trim();
    const nomeMandante = nuovoMandante.trim();
    if (!nomeInterno || !nomeMandante) return;
    if (
      items.some(
        (p) =>
          p.nomeInterno.trim().toLowerCase() === nomeInterno.toLowerCase() ||
          p.nomeMandante.trim().toLowerCase() === nomeMandante.toLowerCase()
      )
    ) {
      return;
    }
    const newItem = perimetroToForm(emptyPerimetro(nomeInterno, nomeMandante));
    commit((prev) => [...prev, newItem]);
    setActivePerimetroId(newItem.id);
    setNuovoInterno("");
    setNuovoMandante("");
  }

  function togglePerimetro(id: string) {
    setActivePerimetroId((cur) => (cur === id ? null : id));
  }

  function removePerimetro(id: string) {
    commit((prev) => prev.filter((p) => p.id !== id));
    setActivePerimetroId((cur) => (cur === id ? null : cur));
  }

  function updatePerimetro(id: string, patch: Partial<PerimetroForm>) {
    commit((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const perimetriPendingCodiciSave = items.filter(
    (p) => p.codiciScarico.length > 0 && !perimetroProvvigioniUnlocked(p)
  );

  return (
    <div className="space-y-3 p-3">
      <p className="text-[10px] text-[var(--muted)]">
        Ogni perimetro collega il codice/descrizione interno dell&apos;agenzia a quello della
        mandante. Definisci prima i codici scarico, poi configura provvigioni e messaggi SMS.
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
                    <span className="mx-1.5 font-normal text-[var(--muted)]">·</span>
                    {p.nomeMandante.trim() || "—"}
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
                    <label className="min-w-[140px] flex-1 text-xs">
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                        Codice/descrizione agenzia
                      </span>
                      <input
                        value={p.nomeInterno}
                        onChange={(e) => updatePerimetro(p.id, { nomeInterno: e.target.value })}
                        className="h-8 w-full rounded border border-[var(--line)] bg-white px-2 text-sm font-semibold text-[var(--navy)]"
                        placeholder="es. BNL Energia 2024"
                      />
                    </label>
                    <label className="min-w-[140px] flex-1 text-xs">
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                        Codice/descrizione mandante
                      </span>
                      <input
                        value={p.nomeMandante}
                        onChange={(e) => updatePerimetro(p.id, { nomeMandante: e.target.value })}
                        className="h-8 w-full rounded border border-[var(--line)] bg-white px-2 text-sm font-semibold text-[var(--navy)]"
                        placeholder="es. 112608"
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              {expanded ? (
                <div className="space-y-3 p-3">
                  <CodiciScaricoPerimetroEditor
                    codici={p.codiciScarico}
                    onChange={(codiciScarico) =>
                      updatePerimetro(p.id, {
                        codiciScarico,
                        ricevuta: cleanLatoCodici(p.ricevuta, codiciScarico),
                        pagata: cleanLatoCodici(p.pagata, codiciScarico),
                      })
                    }
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
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
              Codice/descrizione agenzia
            </span>
            <input
              value={nuovoInterno}
              onChange={(e) => setNuovoInterno(e.target.value)}
              placeholder="es. BNL Energia 2024"
              disabled={!canCreatePerimetro}
              className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs disabled:bg-[#eef2f6] disabled:text-[var(--muted)]"
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-[var(--muted)]">
              Codice/descrizione mandante
            </span>
            <input
              value={nuovoMandante}
              onChange={(e) => setNuovoMandante(e.target.value)}
              placeholder="es. 112608"
              disabled={!canCreatePerimetro}
              className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs disabled:bg-[#eef2f6] disabled:text-[var(--muted)]"
            />
          </label>
          <button
            type="button"
            onClick={addPerimetro}
            disabled={
              !canCreatePerimetro || !nuovoInterno.trim() || !nuovoMandante.trim()
            }
            className="flex h-8 items-center justify-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Aggiungi perimetro
          </button>
        </div>
      </div>
    </div>
  );
}
