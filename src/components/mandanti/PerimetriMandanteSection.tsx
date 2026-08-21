"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { METODI_INCASSO } from "@/lib/metodoIncasso";
import {
  emptyPerimetro,
  formToLatoMetodo,
  latoMetodoToForm,
  parseOptionalFloat,
  type LatoEconomico,
  type MandantePerimetro,
} from "@/lib/mandantePerimetri";

const inputCls = "h-9 w-full rounded border border-[var(--line)] px-2 text-sm";
const smallInputCls = "h-8 w-full rounded border border-[var(--line)] px-2 text-xs";

type LatoForm = {
  provvPerc: string;
  provvMetodo: Record<string, string>;
  incentivoTipo: string;
  incentivoValore: string;
  incentivoSoglia: string;
  incentivoNote: string;
};

function latoToForm(lato: LatoEconomico): LatoForm {
  return {
    provvPerc: lato.provvigionePerc != null ? String(lato.provvigionePerc) : "",
    provvMetodo: latoMetodoToForm(lato),
    incentivoTipo: lato.incentivoTipo || "",
    incentivoValore: lato.incentivoValore != null ? String(lato.incentivoValore) : "",
    incentivoSoglia: lato.incentivoSoglia != null ? String(lato.incentivoSoglia) : "",
    incentivoNote: lato.incentivoNote || "",
  };
}

function formToLato(form: LatoForm): LatoEconomico {
  return {
    provvigionePerc: parseOptionalFloat(form.provvPerc),
    provvigioniMetodo: formToLatoMetodo(form.provvMetodo),
    incentivoTipo: form.incentivoTipo.trim() || null,
    incentivoValore: parseOptionalFloat(form.incentivoValore),
    incentivoSoglia: parseOptionalFloat(form.incentivoSoglia),
    incentivoNote: form.incentivoNote.trim() || null,
  };
}

function LatoEconomicoEditor({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: LatoForm;
  onChange: (next: LatoForm) => void;
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

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
            Tipo incentivo
          </span>
          <select
            value={value.incentivoTipo}
            onChange={(e) => onChange({ ...value, incentivoTipo: e.target.value })}
            className={inputCls}
          >
            <option value="">— Nessuno —</option>
            <option value="percentuale">% su incassi</option>
            <option value="cash">Importo fisso</option>
          </select>
        </label>
        {value.incentivoTipo ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                {value.incentivoTipo === "percentuale" ? "Percentuale (%)" : "Importo (€)"}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={value.incentivoValore}
                onChange={(e) => onChange({ ...value, incentivoValore: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Soglia minima (€)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={value.incentivoSoglia}
                onChange={(e) => onChange({ ...value, incentivoSoglia: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Note incentivo
              </span>
              <textarea
                value={value.incentivoNote}
                onChange={(e) => onChange({ ...value, incentivoNote: e.target.value })}
                rows={2}
                className="w-full rounded border border-[var(--line)] px-2 py-1 text-sm"
              />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}

type PerimetroForm = {
  id: string;
  nome: string;
  ricevuta: LatoForm;
  pagata: LatoForm;
  open: boolean;
};

function perimetroToForm(p: MandantePerimetro, open = false): PerimetroForm {
  return {
    id: p.id,
    nome: p.nome,
    ricevuta: latoToForm(p.ricevuta),
    pagata: latoToForm(p.pagata),
    open,
  };
}

export function formPerimetriToData(items: PerimetroForm[]): MandantePerimetro[] {
  return items
    .map((p) => {
      const nome = p.nome.trim();
      if (!nome) return null;
      return {
        id: p.id,
        nome,
        ricevuta: formToLato(p.ricevuta),
        pagata: formToLato(p.pagata),
      } satisfies MandantePerimetro;
    })
    .filter((p): p is MandantePerimetro => p != null);
}

export function PerimetriMandanteSection({
  initial,
  onChange,
}: {
  initial: MandantePerimetro[];
  onChange: (items: MandantePerimetro[]) => void;
}) {
  const [items, setItems] = useState<PerimetroForm[]>(
    initial.length ? initial.map((p, i) => perimetroToForm(p, i === 0)) : []
  );
  const [nuovoNome, setNuovoNome] = useState("");

  function sync(next: PerimetroForm[]) {
    setItems(next);
    onChange(formPerimetriToData(next));
  }

  function addPerimetro() {
    const nome = nuovoNome.trim();
    if (!nome) return;
    if (items.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) return;
    const p = emptyPerimetro(nome);
    sync([...items, perimetroToForm(p, true)]);
    setNuovoNome("");
  }

  function removePerimetro(id: string) {
    sync(items.filter((p) => p.id !== id));
  }

  function updatePerimetro(id: string, patch: Partial<PerimetroForm>) {
    sync(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-[10px] text-[var(--muted)]">
        Ogni perimetro è una commessa gestita per la mandante. Configura separatamente ciò
        che l&apos;azienda riceve dalla committente e ciò che paga ai collaboratori.
      </p>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nessun perimetro definito.</p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="rounded border border-[var(--line)] bg-[#fafbfc]">
              <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[#eef2f6] px-2 py-1.5">
                <input
                  value={p.nome}
                  onChange={(e) => updatePerimetro(p.id, { nome: e.target.value })}
                  className="h-8 min-w-0 flex-1 rounded border border-[var(--line)] bg-white px-2 text-sm font-semibold text-[var(--navy)]"
                  placeholder="Nome commessa / perimetro"
                />
                <button
                  type="button"
                  onClick={() => updatePerimetro(p.id, { open: !p.open })}
                  className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-white"
                  title={p.open ? "Comprimi" : "Espandi"}
                >
                  {p.open ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
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
              {p.open ? (
                <div className="grid gap-3 p-3 lg:grid-cols-2">
                  <LatoEconomicoEditor
                    title="Ricevute dalla committente"
                    subtitle="Provvigioni e incentivi che l'azienda incassa dalla mandante su questo perimetro."
                    value={p.ricevuta}
                    onChange={(ricevuta) => updatePerimetro(p.id, { ricevuta })}
                  />
                  <LatoEconomicoEditor
                    title="Pagate ai collaboratori"
                    subtitle="Provvigioni e incentivi che l'azienda riconosce agli operatori su questo perimetro."
                    value={p.pagata}
                    onChange={(pagata) => updatePerimetro(p.id, { pagata })}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="rounded border border-dashed border-[var(--accent)] bg-white p-2">
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={nuovoNome}
            onChange={(e) => setNuovoNome(e.target.value)}
            placeholder="Nome perimetro / commessa (es. CG Energia 2024)"
            className="h-8 min-w-[220px] flex-1 rounded border border-[var(--line)] px-2 text-xs"
          />
          <button
            type="button"
            onClick={addPerimetro}
            disabled={!nuovoNome.trim()}
            className="flex h-8 items-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Aggiungi perimetro
          </button>
        </div>
      </div>
    </div>
  );
}
