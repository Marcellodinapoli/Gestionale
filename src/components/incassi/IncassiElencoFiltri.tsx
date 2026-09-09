"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_BAR_CONTAINER_CLASS,
  FILTRI_FIELD_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
  FILTRI_RESET_BUTTON_CLASS,
} from "@/components/filtri/filtriFieldStyles";
import { incMeseSelectOptions } from "@/lib/incassiMeseFiltro";
import { METODI_INCASSO } from "@/lib/metodoIncasso";
import { MODI_INCASSO_PROVV } from "@/lib/incassoFattura";
import {
  hasIncassiElencoFiltri,
  type IncassiElencoFiltri,
} from "@/lib/incassiElencoUi";
import {
  lottoFiltroOptions,
  perimetroFiltroOptions,
} from "@/lib/filtriPerimetroLottoUi";
import type { MandantePerimetriRef } from "@/lib/filtriCodScaricoPerimetro";

const labelClass = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";
const fieldClass = FILTRI_FIELD_CLASS;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function DaA({
  label,
  nameDa,
  nameA,
  defaultDa,
  defaultA,
  type = "date",
  placeholderDa,
  placeholderA,
}: {
  label: string;
  nameDa: string;
  nameA: string;
  defaultDa?: string;
  defaultA?: string;
  type?: "date" | "text";
  placeholderDa?: string;
  placeholderA?: string;
}) {
  return (
    <div className="min-w-0">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          name={nameDa}
          defaultValue={defaultDa || ""}
          placeholder={placeholderDa || "Da"}
          className={fieldClass}
        />
        <span className="text-xs text-[var(--muted)]">–</span>
        <input
          type={type}
          name={nameA}
          defaultValue={defaultA || ""}
          placeholder={placeholderA || "A"}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

export function IncassiElencoFiltriBar({
  filtri,
  operatori,
  mandanti,
  lotti,
  lottiPerMandato,
  mandantiPerimetri,
  meseParam,
}: {
  filtri: IncassiElencoFiltri;
  operatori: Array<{ id: string; name: string }>;
  mandanti: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti: string[];
  lottiPerMandato: Record<string, string[]>;
  mandantiPerimetri: MandantePerimetriRef[];
  meseParam?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mandato, setMandato] = useState(filtri.mandato || "");
  const [perimetro, setPerimetro] = useState(filtri.perimetro || "");
  const [lotto, setLotto] = useState(filtri.lotto || "");
  const meseOpts = useMemo(() => incMeseSelectOptions(36), []);
  const perimetriOpts = useMemo(
    () => perimetroFiltroOptions(mandantiPerimetri, mandato),
    [mandantiPerimetri, mandato]
  );
  const lottiOpts = useMemo(
    () => lottoFiltroOptions(lotti, lottiPerMandato, mandato),
    [lotti, lottiPerMandato, mandato]
  );
  const hasFilters = hasIncassiElencoFiltri(filtri);

  return (
    <>
      <div className={FILTRI_BAR_CONTAINER_CLASS}>
        <form method="get" action="/incassi" className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className={labelClass}>Mandato</span>
            <select
              name="mandato"
              defaultValue={filtri.mandato || ""}
              className={FILTRI_PAGE_SELECT_CLASS}
            >
              <option value="">Tutti</option>
              {mandanti.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codice} — {m.ragioneSociale}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Mese</span>
            <select
              name="mese"
              defaultValue={meseParam || filtri.mese || ""}
              className={FILTRI_PAGE_SELECT_CLASS}
            >
              {meseOpts.map((o) => (
                <option key={o.value || "corrente"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Operatore</span>
            <select
              name="operatore"
              defaultValue={filtri.operatore || ""}
              className={FILTRI_PAGE_SELECT_CLASS}
            >
              <option value="">Tutti</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Verificato / provv.</span>
            <select
              name="modo"
              defaultValue={filtri.modo || ""}
              className={FILTRI_PAGE_SELECT_CLASS}
            >
              <option value="">Tutti</option>
              {MODI_INCASSO_PROVV.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={FILTRI_APPLY_BUTTON_CLASS}>
            Filtra
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${FILTRI_APPLY_BUTTON_CLASS} inline-flex items-center gap-1.5`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Tutti i filtri
          </button>
          {hasFilters ? (
            <Link href="/incassi" className={FILTRI_RESET_BUTTON_CLASS}>
              Annulla filtri
            </Link>
          ) : null}
        </form>
      </div>

      <Modal open={open} title="Tutti i filtri · Incassi" onClose={() => setOpen(false)} wide>
        <form method="get" action="/incassi" className="space-y-3">
          <section className="space-y-2 rounded-lg border border-[var(--line)]/70 bg-[#f5efe6] p-3">
            <h3 className="text-sm font-bold text-[var(--navy)]">Filtri principali</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Mandato">
                <select
                  name="mandato"
                  value={mandato}
                  onChange={(e) => {
                    setMandato(e.target.value);
                    setPerimetro("");
                    setLotto("");
                  }}
                  className={fieldClass}
                >
                  <option value="">Tutti</option>
                  {mandanti.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codice} — {m.ragioneSociale}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Perimetro">
                <select
                  name="perimetro"
                  value={perimetro}
                  onChange={(e) => {
                    setPerimetro(e.target.value);
                    setLotto("");
                  }}
                  className={fieldClass}
                >
                  <option value="">Tutti</option>
                  {perimetriOpts.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Operatore">
                <select
                  name="operatore"
                  defaultValue={filtri.operatore || ""}
                  className={fieldClass}
                >
                  <option value="">Tutti</option>
                  {operatori.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Verificato / provvigioneabile">
                <select name="modo" defaultValue={filtri.modo || ""} className={fieldClass}>
                  <option value="">Tutti</option>
                  {MODI_INCASSO_PROVV.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mese">
                <select
                  name="mese"
                  defaultValue={meseParam || filtri.mese || ""}
                  className={fieldClass}
                >
                  {meseOpts.map((o) => (
                    <option key={o.value || "corrente"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <DaA
                label="Incasso dal / al"
                nameDa="dataDa"
                nameA="dataA"
                defaultDa={filtri.dataDa}
                defaultA={filtri.dataA}
              />
              <Field label="Lotto">
                <select
                  name="lotto"
                  value={lotto}
                  onChange={(e) => setLotto(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Tutti</option>
                  {lottiOpts.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Città">
                <input
                  name="citta"
                  defaultValue={filtri.citta || ""}
                  className={fieldClass}
                  placeholder="Città"
                />
              </Field>
              <Field label="Cliente">
                <input
                  name="cliente"
                  defaultValue={filtri.cliente || ""}
                  className={fieldClass}
                  placeholder="Nome o cognome"
                />
              </Field>
              <DaA
                label="Data affido da / a"
                nameDa="affidoDa"
                nameA="affidoA"
                defaultDa={filtri.affidoDa}
                defaultA={filtri.affidoA}
              />
              <Field label="Tipo di incasso">
                <select
                  name="metodo"
                  defaultValue={filtri.metodo || ""}
                  className={fieldClass}
                >
                  <option value="">Tutti</option>
                  {METODI_INCASSO.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ricevuta n°">
                <input
                  name="ricevuta"
                  defaultValue={filtri.ricevuta || ""}
                  className={fieldClass}
                  placeholder="N. ricevuta / fattura"
                />
              </Field>
              <Field label="Causale">
                <input
                  name="causale"
                  defaultValue={filtri.causale || ""}
                  className={fieldClass}
                  placeholder="Causale"
                />
              </Field>
              <DaA
                label="CAP da / a"
                nameDa="capDa"
                nameA="capA"
                type="text"
                defaultDa={filtri.capDa}
                defaultA={filtri.capA}
                placeholderDa="CAP da"
                placeholderA="CAP a"
              />
              <DaA
                label="Data scarico ricevuta da / a"
                nameDa="scaricoDa"
                nameA="scaricoA"
                defaultDa={filtri.scaricoDa}
                defaultA={filtri.scaricoA}
              />
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
            >
              Chiudi
            </button>
            <Link
              href="/incassi"
              className="inline-flex h-9 items-center rounded-lg border border-[var(--danger)]/30 bg-[#fef2f2] px-4 text-sm text-[var(--danger)] hover:bg-[#fee2e2]"
            >
              Azzera
            </Link>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Applica filtri
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
