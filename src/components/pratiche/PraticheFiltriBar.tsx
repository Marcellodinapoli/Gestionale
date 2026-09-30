"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { STATI_FILTRO_PRATICHE } from "@/lib/statoOperativoPratica";
import { formatDataIso, startOfToday, LAVORATE_FASCE, type LavorateFascia } from "@/lib/lavorateOggiUi";
import { type AltriFiltri } from "@/lib/praticheAltriFiltriUi";
import {
  FILTRO_SRC_PARAM,
  parseFiltroSrc,
  tuttiFiltriPraticheAttivi,
} from "@/lib/filtroVeloceEsclusivo";
import { CodScaricoFiltroControls } from "@/components/filtri/CodScaricoFiltroControls";
import { OperatoreFiltroControls } from "@/components/filtri/OperatoreFiltroControls";
import { AggiuntivoFiltroControls } from "@/components/filtri/AggiuntivoFiltroControls";
import { TextFiltroControls } from "@/components/filtri/TextFiltroControls";
import { FILTRI_FIELD_CLASS, QUICK_BAR_COMPOUND_FIELD_CLASS, QUICK_BAR_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";
import { SelectFiltroControls } from "@/components/filtri/SelectFiltroControls";
import { TEXT_FILTER_DEFAULT } from "@/lib/filtriTestoOp";
import {
  codiciScaricoFiltroDisponibili,
  type MandantePerimetriRef,
} from "@/lib/filtriCodScaricoPerimetro";
import {
  lottoFiltroOptions,
  mandatoIdPerPerimetroFiltro,
  perimetroFiltroOptions,
} from "@/lib/filtriPerimetroLottoUi";

const quickBarLabelClass =
  "mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--navy)]";
const modalField = FILTRI_FIELD_CLASS;
const modalLabel = quickBarLabelClass;

export const APRI_ALTRI_FILTRI_EVENT = "credixa:apri-altri-filtri";

export function apriAltriFiltri() {
  window.dispatchEvent(new Event(APRI_ALTRI_FILTRI_EVENT));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={modalLabel}>{label}</span>
      {children}
    </label>
  );
}

function SezioneFiltri({
  title,
  tone = "codici",
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

function DaA({
  label,
  nameDa,
  nameA,
  type = "date",
  defaultDa,
  defaultA,
  placeholderDa,
  placeholderA,
  step,
}: {
  label: string;
  nameDa: string;
  nameA: string;
  type?: "date" | "text" | "number";
  defaultDa?: string;
  defaultA?: string;
  placeholderDa?: string;
  placeholderA?: string;
  step?: string;
}) {
  return (
    <div className="min-w-0">
      <span className={modalLabel}>{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          name={nameDa}
          defaultValue={defaultDa || ""}
          placeholder={placeholderDa || "Da"}
          step={step}
          className={modalField}
        />
        <span className="text-xs text-[var(--muted)]">–</span>
        <input
          type={type}
          name={nameA}
          defaultValue={defaultA || ""}
          placeholder={placeholderA || "A"}
          step={step}
          className={modalField}
        />
      </div>
    </div>
  );
}

export function PraticheFiltriBar({
  q,
  stato,
  lavorate,
  lavorateData,
  lavorateDa,
  lavorateA,
  lavorateOggi,
  lavorateFascia,
  nonToccateDa,
  sort,
  dir,
  operatori,
  mandanti,
  lotti,
  lottiPerMandato,
  altri,
  mandantiPerimetri,
  apriPraticheHref,
  nascondiFiltroStato = false,
  searchActive = false,
  searchParams = {},
}: {
  q?: string;
  stato?: string;
  lavorate?: boolean;
  lavorateData?: string;
  lavorateDa?: string;
  lavorateA?: string;
  lavorateOggi?: boolean;
  lavorateFascia?: LavorateFascia;
  nonToccateDa?: 10;
  sort?: string;
  dir?: string;
  operatori?: Array<{ id: string; name: string; acronimo?: string | null }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
  lottiPerMandato?: Record<string, string[]>;
  altri?: AltriFiltri;
  mandantiPerimetri?: MandantePerimetriRef[];
  apriPraticheHref?: string | null;
  /** Operatore: niente tendina stato, solo pratiche in lavorazione. */
  nascondiFiltroStato?: boolean;
  /** Elenco già caricato (cerca=1 / elenco speciale). */
  searchActive?: boolean;
  /** Parametri URL correnti (per filtroSrc). */
  searchParams?: Record<string, string | undefined>;
}) {
  const STATO_PLACEHOLDER = "";
  const hasQ = Boolean(q?.trim());
  // Nessun default: l’utente sceglie stato / filtri (ricerca generica → Tutti).
  const statoEffettivo = nascondiFiltroStato
    ? hasQ
      ? "TUTTI"
      : STATO_PLACEHOLDER
    : hasQ
      ? "TUTTI"
      : stato || STATO_PLACEHOLDER;
  // Opzione selezionata per prima: alcuni browser riordinano le <option> e rompono l’hydration.
  const statiFiltroOpts = useMemo(() => {
    const list = STATI_FILTRO_PRATICHE.map((o) => ({ value: o.value, label: o.label }));
    const idx = list.findIndex((o) => o.value === statoEffettivo);
    if (idx > 0) {
      const [sel] = list.splice(idx, 1);
      if (sel) list.unshift(sel);
    }
    return list;
  }, [statoEffettivo]);
  const a = altri || {};
  const [altriFiltriOpen, setAltriFiltriOpen] = useState(false);
  const [modalMandato, setModalMandato] = useState("");
  const [modalPerimetro, setModalPerimetro] = useState("");
  const [modalLotto, setModalLotto] = useState("");
  const [barPerimetro, setBarPerimetro] = useState(() => a.perimetro || "");
  // Non copiare Da→A: è valido compilare una sola data (dal = da quella in poi; al = fino a quella).
  const oggiIso = formatDataIso(startOfToday());
  const legacySingoloGiorno = !lavorateDa && !lavorateA && !!(lavorateData || lavorateOggi);
  const dataLavorateDa =
    lavorateDa || (legacySingoloGiorno ? lavorateData || oggiIso : undefined);
  const dataLavorateA =
    lavorateA || (legacySingoloGiorno ? lavorateData || oggiIso : undefined);
  const hasFilters = searchActive;
  const tuttiFiltriAttivi = tuttiFiltriPraticheAttivi(searchParams, a);
  const perimetriBarOpts = useMemo(
    () => perimetroFiltroOptions(mandantiPerimetri, a.mandato),
    [mandantiPerimetri, a.mandato]
  );
  const perimetroBarEffettivo = barPerimetro || a.perimetro || "";
  const barMandatoId =
    a.mandato || mandatoIdPerPerimetroFiltro(mandantiPerimetri, perimetroBarEffettivo);
  const codiciScaricoBar = useMemo(
    () =>
      codiciScaricoFiltroDisponibili(
        mandantiPerimetri,
        barMandatoId,
        perimetroBarEffettivo,
        "operatori"
      ),
    [mandantiPerimetri, barMandatoId, perimetroBarEffettivo]
  );
  const codiciScaricoBkBar = useMemo(
    () =>
      codiciScaricoFiltroDisponibili(
        mandantiPerimetri,
        barMandatoId,
        perimetroBarEffettivo,
        "bkOff"
      ),
    [mandantiPerimetri, barMandatoId, perimetroBarEffettivo]
  );
  const perimetriModalOpts = useMemo(
    () => perimetroFiltroOptions(mandantiPerimetri, modalMandato),
    [mandantiPerimetri, modalMandato]
  );
  const lottiModalOpts = useMemo(
    () => lottoFiltroOptions(lotti, lottiPerMandato, modalMandato),
    [lotti, lottiPerMandato, modalMandato]
  );
  const codiciScaricoModal = useMemo(
    () =>
      codiciScaricoFiltroDisponibili(
        mandantiPerimetri,
        modalMandato,
        modalPerimetro,
        "operatori"
      ),
    [mandantiPerimetri, modalMandato, modalPerimetro]
  );
  const codiciScaricoBkModal = useMemo(
    () =>
      codiciScaricoFiltroDisponibili(
        mandantiPerimetri,
        modalMandato,
        modalPerimetro,
        "bkOff"
      ),
    [mandantiPerimetri, modalMandato, modalPerimetro]
  );

  useEffect(() => {
    setBarPerimetro(a.perimetro || "");
  }, [a.perimetro]);

  useEffect(() => {
    if (!altriFiltriOpen) return;
    const src = parseFiltroSrc(searchParams);
    if (src === "veloce") {
      setModalMandato("");
      setModalPerimetro("");
      setModalLotto("");
      return;
    }
    setModalMandato(a.mandato || "");
    setModalPerimetro(a.perimetro || "");
    setModalLotto(a.lotto || "");
  }, [altriFiltriOpen, a.mandato, a.perimetro, a.lotto, searchParams]);

  useEffect(() => {
    function onApri() {
      setAltriFiltriOpen(true);
    }
    window.addEventListener(APRI_ALTRI_FILTRI_EVENT, onApri);
    return () => window.removeEventListener(APRI_ALTRI_FILTRI_EVENT, onApri);
  }, []);

  const hiddenNav = (
    <>
      <input type="hidden" name="page" value="1" />
      {lavorate ? <input type="hidden" name="lavorate" value="1" /> : null}
      {nonToccateDa ? (
        <input type="hidden" name="nonToccateDa" value={String(nonToccateDa)} />
      ) : null}
      {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      {dir ? <input type="hidden" name="dir" value={dir} /> : null}
    </>
  );

  return (
    <>
      <div className="mb-3 shrink-0">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Filtro veloce
        </h2>
      <form
        id="pratiche-filtro-veloce"
        method="get"
        action="/pratiche"
        className="notranslate flex w-full flex-wrap items-end gap-1.5 pb-0.5"
        translate="no"
        onSubmit={(e) => {
          const form = e.currentTarget;
          const qInput = form.elements.namedItem("q") as HTMLInputElement | null;
          const statoSel = form.elements.namedItem("stato") as
            | HTMLSelectElement
            | HTMLInputElement
            | null;
          if (qInput?.value.trim() && statoSel) {
            statoSel.value = "TUTTI";
          }
          // Ricerca generica: non limitare per operatore (Nuove / altre pratiche).
          if (qInput?.value.trim()) {
            const op = form.elements.namedItem("operatore") as
              | HTMLSelectElement
              | HTMLInputElement
              | null;
            if (op) op.value = "";
          }
        }}
      >
        <input type="hidden" name="cerca" value="1" />
        <input type="hidden" name={FILTRO_SRC_PARAM} value="veloce" />
        {hiddenNav}

        <div className="min-w-[9rem] flex-1">
        <input
          name="q"
          defaultValue={q}
            placeholder="Cerca anagrafica…"
            autoComplete="off"
            className={`${QUICK_BAR_FIELD_CLASS} w-full min-w-0 px-2`}
        />
        </div>
        {nascondiFiltroStato ? (
          hasQ ? <input type="hidden" name="stato" value="TUTTI" /> : null
        ) : (
          <select
            name="stato"
            key={`stato-${statoEffettivo || "none"}`}
            defaultValue={statoEffettivo}
            onChange={(e) => {
              e.currentTarget.form?.requestSubmit();
            }}
            className={`notranslate ${QUICK_BAR_FIELD_CLASS} w-[8.75rem] shrink-0 px-2`}
            aria-label="Stato operativo"
            translate="no"
            suppressHydrationWarning
          >
            <option value="">— Seleziona —</option>
            {statiFiltroOpts.map(({ value, label }) => (
              <option key={value} value={value} translate="no" className="notranslate">
                {label}
              </option>
            ))}
          </select>
        )}
        <label className="block w-[9.5rem] shrink-0">
          <span className={quickBarLabelClass}>Perimetro</span>
          <SelectFiltroControls
            name="perimetro"
            opName="perimetroOp"
            defaultValue={a.perimetro || ""}
            value={barPerimetro}
            op={a.perimetroOp || TEXT_FILTER_DEFAULT}
            fieldClass={QUICK_BAR_COMPOUND_FIELD_CLASS}
            ariaLabel="Perimetro"
            onValueChange={setBarPerimetro}
          >
            <option value="">— Seleziona —</option>
            {perimetriBarOpts.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            {a.perimetro && !perimetriBarOpts.some((p) => p.value === a.perimetro) ? (
              <option value={a.perimetro}>{a.perimetro} (chiuso)</option>
            ) : null}
          </SelectFiltroControls>
        </label>
        <label className="block w-[10.5rem] shrink-0">
          <span className={quickBarLabelClass}>Cod. operatore</span>
          <OperatoreFiltroControls
            operatore={a.operatore}
            operatoreOp={a.operatoreOp}
            fieldClass={QUICK_BAR_COMPOUND_FIELD_CLASS}
            operatori={operatori || []}
            disabled={!operatori?.length}
          />
        </label>
        <label className="block w-[10.5rem] shrink-0">
          <span className={quickBarLabelClass}>Cod. scarico</span>
          <CodScaricoFiltroControls
            codScarico={a.codScarico}
            codScaricoOp={a.codScaricoOp}
            fieldClass={QUICK_BAR_COMPOUND_FIELD_CLASS}
            mandatoId={barMandatoId}
            perimetroSelezionato={Boolean(perimetroBarEffettivo)}
            codiciDisponibili={codiciScaricoBar}
          />
        </label>
        <label className="block w-[10.5rem] shrink-0">
          <span className={quickBarLabelClass}>Cod. bk off</span>
          <CodScaricoFiltroControls
            codScarico={a.codScaricoBk}
            codScaricoOp={a.codScaricoBkOp}
            opName="codScaricoBkOp"
            codeName="codScaricoBk"
            fieldClass={QUICK_BAR_COMPOUND_FIELD_CLASS}
            mandatoId={barMandatoId}
            perimetroSelezionato={Boolean(perimetroBarEffettivo)}
            codiciDisponibili={codiciScaricoBkBar}
          />
        </label>
        <label className={`flex h-10 shrink-0 items-center gap-1 px-1.5 text-xs ${QUICK_BAR_FIELD_CLASS}`}>
          <span className="whitespace-nowrap text-[var(--muted)]">Dal</span>
          <input
            type="date"
            name="lavorateDa"
            defaultValue={dataLavorateDa || ""}
            className="h-8 w-[6.75rem] min-w-0 border-0 bg-transparent p-0 text-xs text-[var(--navy)]"
          />
          <span className="text-[var(--muted)]">al</span>
          <input
            type="date"
            name="lavorateA"
            defaultValue={dataLavorateA || ""}
            className="h-8 w-[6.75rem] min-w-0 border-0 bg-transparent p-0 text-xs text-[var(--navy)]"
          />
        </label>
        <select
          name="lavorateFascia"
          defaultValue={lavorateFascia || ""}
          className={`${QUICK_BAR_FIELD_CLASS} w-[8.25rem] shrink-0 px-2`}
          title="Fascia oraria lavorazione"
        >
          <option value="">Tutta la giornata</option>
          {LAVORATE_FASCE.map((f) => (
            <option key={f.value} value={f.value} title={`${f.label} (${f.range})`}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-lg border-2 border-[var(--navy)] bg-[#eef4f8] px-3 text-sm font-semibold text-[var(--navy)] shadow-sm transition-colors hover:bg-[#dce8f0]"
        >
          Filtra
        </button>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setAltriFiltriOpen(true)}
          className={`inline-flex h-10 items-center gap-1 rounded-lg px-4 text-sm font-semibold shadow-md transition-colors ${
            tuttiFiltriAttivi
              ? "bg-[var(--navy)] text-white ring-2 ring-amber-400 hover:opacity-90"
              : "bg-[var(--navy)] text-white hover:bg-[#1a3650]"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          Tutti i filtri
        </button>
        {hasFilters ? (
          <Link
            href="/pratiche"
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--danger)]/30 bg-[#fef2f2] px-4 text-sm text-[var(--danger)] transition-colors hover:bg-[#fee2e2]"
          >
            <X className="h-4 w-4" />
            Annulla filtri
          </Link>
        ) : null}
        {apriPraticheHref ? (
          <Link
            href={apriPraticheHref}
            prefetch
            className="inline-flex h-10 items-center rounded-lg border-2 border-emerald-600 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100"
          >
            Apri pratiche
          </Link>
        ) : null}
      </div>
      </div>

      <Modal
        open={altriFiltriOpen}
        title="Tutti i filtri"
        onClose={() => setAltriFiltriOpen(false)}
        wide
      >
        <form method="get" action="/pratiche" className="space-y-4 p-4">
          <input type="hidden" name="cerca" value="1" />
          <input type="hidden" name={FILTRO_SRC_PARAM} value="tutti" />
          {hiddenNav}

          <div className="space-y-5">
            <SezioneFiltri title="Filtri anagrafica" tone="anagrafica">
              <Field label="Debitore">
                <TextFiltroControls
                  name="debitore"
                  opName="debitoreOp"
                  value={a.debitore || ""}
                  op={a.debitoreOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  placeholder="Nome / cognome"
                />
              </Field>
              <Field label="Città">
                <TextFiltroControls
                  name="citta"
                  opName="cittaOp"
                  value={a.citta || ""}
                  op={a.cittaOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  placeholder="Città debitore"
                />
              </Field>
              <Field label="Prov.">
                <TextFiltroControls
                  name="prov"
                  opName="provOp"
                  value={a.prov || ""}
                  op={a.provOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  placeholder="Provincia"
                />
              </Field>
              <Field label="Telefono">
                <TextFiltroControls
                  name="telefono"
                  opName="telefonoOp"
                  value={a.telefono || ""}
                  op={a.telefonoOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  placeholder="Telefono"
                  inputType="tel"
                />
              </Field>
              <DaA
                label="CAP da / a"
                nameDa="capDa"
                nameA="capA"
                type="text"
                defaultDa={a.capDa}
                defaultA={a.capA}
                placeholderDa="00000"
                placeholderA="99999"
              />
              <Field label="C.F. / P.IVA">
                <TextFiltroControls
                  name="cfPiva"
                  opName="cfPivaOp"
                  value={a.cfPiva || ""}
                  op={a.cfPivaOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  placeholder="Codice fiscale"
                />
              </Field>
              <Field label="Garante">
                <TextFiltroControls
                  name="garante"
                  opName="garanteOp"
                  value={a.garante || ""}
                  op={a.garanteOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  placeholder="Nome / CF garante"
                />
              </Field>
              <Field label="Note">
                <TextFiltroControls
                  name="note"
                  opName="noteOp"
                  value={a.note || ""}
                  op={a.noteOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  placeholder="Testo in note / attività"
                />
              </Field>
            </SezioneFiltri>

            <SezioneFiltri title="Filtri contabili" tone="contabili">
              <DaA
                label="Importo rata da / a"
                nameDa="importoRataDa"
                nameA="importoRataA"
                type="number"
                step="0.01"
                defaultDa={a.importoRataDa}
                defaultA={a.importoRataA}
              />
              <DaA
                label="Debito residuo da / a"
                nameDa="residuoDa"
                nameA="residuoA"
                type="number"
                step="0.01"
                defaultDa={a.residuoDa}
                defaultA={a.residuoA}
              />
              <DaA
                label="Tot. incassato da / a"
                nameDa="totIncassatoDa"
                nameA="totIncassatoA"
                type="number"
                step="0.01"
                defaultDa={a.totIncassatoDa}
                defaultA={a.totIncassatoA}
              />
              <DaA
                label="Importo totale da / a"
                nameDa="importoTotDa"
                nameA="importoTotA"
                type="number"
                step="0.01"
                defaultDa={a.importoTotDa}
                defaultA={a.importoTotA}
              />
              <DaA
                label="Prom. pag. dal / al"
                nameDa="promPagDa"
                nameA="promPagA"
                defaultDa={a.promPagDa}
                defaultA={a.promPagA}
                placeholderDa="Dal"
                placeholderA="Al"
              />
              <DaA
                label="Incassato (data) da / a"
                nameDa="incassatoDa"
                nameA="incassatoA"
                defaultDa={a.incassatoDa}
                defaultA={a.incassatoA}
              />
              <Field label="Rate scadute">
                <select name="rateScadute" defaultValue={a.rateScadute || ""} className={modalField}>
                  <option value="">— Seleziona —</option>
                  <option value="1">Con rate scadute</option>
                  <option value="0">Senza rate scadute</option>
                </select>
              </Field>
            </SezioneFiltri>

            <SezioneFiltri title="Filtri codici" tone="codici">
              <Field label="Cod. operatore">
                <OperatoreFiltroControls
                  operatore={a.operatore}
                  operatoreOp={a.operatoreOp}
                  fieldClass={modalField}
                  operatori={operatori || []}
                  disabled={!operatori?.length}
                />
              </Field>
              <Field label="Sit. affido">
                <SelectFiltroControls
                  name="sitAffido"
                  opName="sitAffidoOp"
                  defaultValue={a.sitAffido || ""}
                  op={a.sitAffidoOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  ariaLabel="Sit. affido"
                >
                  <option value="">— Seleziona —</option>
                  <option value="affidata">Affidata</option>
                  <option value="non_affidata">Non affidata</option>
                  <option value="temporanea">Affido temporaneo</option>
                </SelectFiltroControls>
              </Field>
              <Field label="Affido provvisorio">
                <select
                  name="affidoProvvisorio"
                  defaultValue={a.affidoProvvisorio || ""}
                  className={modalField}
                >
                  <option value="">— Seleziona —</option>
                  <option value="1">Sì (solo temporanei)</option>
                </select>
              </Field>
              <Field label="Mandato">
                <SelectFiltroControls
                  name="mandato"
                  opName="mandatoOp"
                  value={modalMandato}
                  op={a.mandatoOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  ariaLabel="Mandato"
                  onValueChange={setModalMandato}
                >
                  <option value="">— Seleziona —</option>
                  {(mandanti || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codice} — {m.ragioneSociale}
                    </option>
                  ))}
                </SelectFiltroControls>
              </Field>
              <Field label="Perimetro">
                <SelectFiltroControls
                  name="perimetro"
                  opName="perimetroOp"
                  value={modalPerimetro}
                  op={a.perimetroOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  ariaLabel="Perimetro"
                  onValueChange={setModalPerimetro}
                >
                  <option value="">— Seleziona —</option>
                  {perimetriModalOpts.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  {a.perimetro &&
                  !perimetriModalOpts.some((p) => p.value === a.perimetro) ? (
                    <option value={a.perimetro}>{a.perimetro} (chiuso)</option>
                  ) : null}
                </SelectFiltroControls>
              </Field>
              <Field label="Lotto">
                <SelectFiltroControls
                  name="lotto"
                  opName="lottoOp"
                  value={modalLotto}
                  op={a.lottoOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                  ariaLabel="Lotto"
                  onValueChange={setModalLotto}
                >
                  <option value="">— Seleziona —</option>
                  {lottiModalOpts.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                  {a.lotto && !lottiModalOpts.includes(a.lotto) ? (
                    <option value={a.lotto}>{a.lotto} (chiuso)</option>
                  ) : null}
                </SelectFiltroControls>
              </Field>
              <DaA
                label="Data affido da / a"
                nameDa="affidoDa"
                nameA="affidoA"
                defaultDa={a.affidoDa}
                defaultA={a.affidoA}
              />
              <DaA
                label="Scad. mandato da / a"
                nameDa="scadenzaDa"
                nameA="scadenzaA"
                defaultDa={a.scadenzaDa}
                defaultA={a.scadenzaA}
              />
              <DaA
                label="Scad. stragiudiziale da / a"
                nameDa="scadenzaStragiudizialeDa"
                nameA="scadenzaStragiudizialeA"
                defaultDa={a.scadenzaStragiudizialeDa}
                defaultA={a.scadenzaStragiudizialeA}
              />
              <Field label="Cod. scarico">
                <CodScaricoFiltroControls
                  codScarico={a.codScarico}
                  codScaricoOp={a.codScaricoOp}
                  fieldClass={modalField}
                  mandatoId={modalMandato}
                  perimetroSelezionato={Boolean(modalPerimetro)}
                  codiciDisponibili={codiciScaricoModal}
                />
              </Field>
              <Field label="Cod. bk off">
                <CodScaricoFiltroControls
                  codScarico={a.codScaricoBk}
                  codScaricoOp={a.codScaricoBkOp}
                  opName="codScaricoBkOp"
                  codeName="codScaricoBk"
                  fieldClass={modalField}
                  mandatoId={modalMandato}
                  perimetroSelezionato={Boolean(modalPerimetro)}
                  codiciDisponibili={codiciScaricoBkModal}
                />
              </Field>
              <DaA
                label="N. pratica da / a"
                nameDa="nPraticaDa"
                nameA="nPraticaA"
                type="text"
                defaultDa={a.nPraticaDa}
                defaultA={a.nPraticaA}
              />
              <DaA
                label="Scarico memo da / a"
                nameDa="memoDa"
                nameA="memoA"
                defaultDa={a.memoDa}
                defaultA={a.memoA}
              />
              <Field label="Aggiuntivo">
                <AggiuntivoFiltroControls
                  campo={a.aggiuntivoCampo}
                  valore={a.aggiuntivoValore}
                  op={a.aggiuntivoOp || TEXT_FILTER_DEFAULT}
                  fieldClass={modalField}
                />
              </Field>
            </SezioneFiltri>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
            <button
              type="button"
              onClick={() => setAltriFiltriOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
            >
              Chiudi
            </button>
            {hasFilters ? (
              <Link
                href="/pratiche"
                className="inline-flex h-9 items-center rounded-lg border border-[var(--danger)]/30 bg-[#fef2f2] px-4 text-sm text-[var(--danger)] hover:bg-[#fee2e2]"
              >
                Azzera
              </Link>
            ) : null}
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
