"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { STATO_LABELS } from "@/lib/permissions";
import { formatDataIso, startOfToday, LAVORATE_FASCE, labelLavorateFascia, type LavorateFascia } from "@/lib/lavorateOggiUi";
import { hasAltriFiltri, ALTRI_FILTRI_PRESERVE_KEYS, type AltriFiltri } from "@/lib/praticheAltriFiltriUi";
import { CodScaricoFiltroControls } from "@/components/filtri/CodScaricoFiltroControls";
import { OperatoreFiltroControls } from "@/components/filtri/OperatoreFiltroControls";
import { AggiuntivoFiltroControls } from "@/components/filtri/AggiuntivoFiltroControls";
import { AltriFiltriAttiviElenco } from "@/components/filtri/AltriFiltriAttiviElenco";
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

const quickBarLabelClass = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";
const modalField = FILTRI_FIELD_CLASS;
const modalLabel = quickBarLabelClass;

const QUICK_BAR_SELF_KEYS = new Set([
  "perimetro",
  "perimetroOp",
  "operatore",
  "operatoreOp",
  "codScarico",
  "codScaricoOp",
]);

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
}) {
  const STATO_DEFAULT = "IN_LAVORAZIONE";
  const [altriFiltriOpen, setAltriFiltriOpen] = useState(false);
  const [modalMandato, setModalMandato] = useState("");
  const [modalPerimetro, setModalPerimetro] = useState("");
  const [modalLotto, setModalLotto] = useState("");
  const [barPerimetro, setBarPerimetro] = useState("");
  // Non copiare Da→A: è valido compilare una sola data (dal = da quella in poi; al = fino a quella).
  const oggiIso = formatDataIso(startOfToday());
  const legacySingoloGiorno = !lavorateDa && !lavorateA && !!(lavorateData || lavorateOggi);
  const dataLavorateDa =
    lavorateDa || (legacySingoloGiorno ? lavorateData || oggiIso : undefined);
  const dataLavorateA =
    lavorateA || (legacySingoloGiorno ? lavorateData || oggiIso : undefined);
  const hasLavorateRange = !!(dataLavorateDa || dataLavorateA);
  const hasFilters = !!(
    q ||
    (stato && stato !== STATO_DEFAULT) ||
    lavorate ||
    hasLavorateRange ||
    lavorateFascia ||
    nonToccateDa ||
    hasAltriFiltri(altri)
  );
  const a = altri || {};
  const perimetriBarOpts = useMemo(
    () => perimetroFiltroOptions(mandantiPerimetri, a.mandato),
    [mandantiPerimetri, a.mandato]
  );
  const barMandatoId = a.mandato || mandatoIdPerPerimetroFiltro(mandantiPerimetri, barPerimetro);
  const codiciScaricoBar = useMemo(
    () => codiciScaricoFiltroDisponibili(mandantiPerimetri, barMandatoId, barPerimetro),
    [mandantiPerimetri, barMandatoId, barPerimetro]
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
    () => codiciScaricoFiltroDisponibili(mandantiPerimetri, modalMandato, modalPerimetro),
    [mandantiPerimetri, modalMandato, modalPerimetro]
  );

  useEffect(() => {
    setBarPerimetro(a.perimetro || "");
  }, [a.perimetro]);

  useEffect(() => {
    if (altriFiltriOpen) {
      setModalMandato(a.mandato || "");
      setModalPerimetro(a.perimetro || "");
      setModalLotto(a.lotto || "");
    }
  }, [altriFiltriOpen, a.mandato, a.perimetro, a.lotto]);

  const altriHiddenKeys = ALTRI_FILTRI_PRESERVE_KEYS.filter(
    (k) => !QUICK_BAR_SELF_KEYS.has(k)
  );

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
        className="flex w-full flex-nowrap items-end gap-1.5 overflow-x-auto pb-0.5"
      >
        {hiddenNav}
        {/* Conserva filtri avanzati quando si usa solo la barra rapida */}
        {hasAltriFiltri(altri)
          ? altriHiddenKeys.map((k) => {
              const v = a[k as keyof AltriFiltri];
              return v ? (
                <input key={k} type="hidden" name={k} value={String(v)} />
              ) : null;
            })
          : null}

        <div className="min-w-[9rem] flex-1">
        <input
          name="q"
          defaultValue={q}
            placeholder="Cerca anagrafica…"
            autoComplete="off"
            className={`${QUICK_BAR_FIELD_CLASS} w-full min-w-0 px-2`}
        />
        </div>
        <select
          name="stato"
          key={`stato-${stato || "all"}`}
          value={stato ?? ""}
          onChange={(e) => {
            e.currentTarget.form?.requestSubmit();
          }}
          className={`${QUICK_BAR_FIELD_CLASS} w-[8.75rem] shrink-0 px-2`}
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(STATO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="block w-[9.5rem] shrink-0">
          <span className={quickBarLabelClass}>Perimetro</span>
          <SelectFiltroControls
            name="perimetro"
            opName="perimetroOp"
            defaultValue={a.perimetro || ""}
            op={a.perimetroOp || TEXT_FILTER_DEFAULT}
            fieldClass={QUICK_BAR_COMPOUND_FIELD_CLASS}
            ariaLabel="Perimetro"
            onValueChange={setBarPerimetro}
          >
            <option value="">Tutti</option>
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
            codiciDisponibili={codiciScaricoBar}
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
            hasAltriFiltri(altri)
              ? "bg-[var(--navy)] text-white ring-2 ring-amber-400 hover:opacity-90"
              : "bg-[var(--navy)] text-white hover:bg-[#1a3650]"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          Tutti i filtri
        </button>
          <Link
            href="/pratiche"
          className={`inline-flex h-10 items-center gap-1 rounded-lg border px-4 text-sm transition-colors ${
            hasFilters
              ? "border-[var(--danger)]/30 bg-[#fef2f2] text-[var(--danger)] hover:bg-[#fee2e2]"
              : "pointer-events-none border-[var(--line)] bg-[#f8fafc] text-[var(--muted)] opacity-60"
          }`}
          aria-disabled={!hasFilters}
          tabIndex={hasFilters ? 0 : -1}
          >
            <X className="h-4 w-4" />
            Annulla filtri
        </Link>
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

      {hasLavorateRange ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Filtro attivo: ultima lavorazione (operatore/supervisor)
          {dataLavorateDa && dataLavorateA
            ? ` dal ${new Date(dataLavorateDa + "T12:00:00").toLocaleDateString("it-IT")} al ${new Date(dataLavorateA + "T12:00:00").toLocaleDateString("it-IT")}`
            : dataLavorateDa
              ? ` dal ${new Date(dataLavorateDa + "T12:00:00").toLocaleDateString("it-IT")} in poi`
              : ` fino al ${new Date(dataLavorateA! + "T12:00:00").toLocaleDateString("it-IT")}`}
          {lavorateFascia ? ` (${labelLavorateFascia(lavorateFascia)})` : ""}
          .
        </p>
      ) : lavorateFascia ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Filtro attivo: lavorazioni di oggi in fascia{" "}
          {lavorateFascia ? labelLavorateFascia(lavorateFascia) : ""}.
        </p>
      ) : null}
      {nonToccateDa ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Filtro attivo: pratiche dormienti (aperte, non aggiornate da almeno{" "}
          {nonToccateDa} giorni; escluse le promesse con data successiva a oggi).
        </p>
      ) : null}

      <AltriFiltriAttiviElenco
        filtri={altri}
        operatori={operatori}
        mandanti={mandanti}
        excludeIds={["cod-scarico", "perimetro", "operatore"]}
      />

      <Modal
        open={altriFiltriOpen}
        title="Tutti i filtri"
        onClose={() => setAltriFiltriOpen(false)}
        wide
      >
        <form method="get" action="/pratiche" className="space-y-4 p-4">
          {hiddenNav}
          <input type="hidden" name="q" value={q || ""} />
          <input type="hidden" name="stato" value={stato || ""} />
          {dataLavorateDa ? (
            <input type="hidden" name="lavorateDa" value={dataLavorateDa} />
          ) : null}
          {dataLavorateA ? (
            <input type="hidden" name="lavorateA" value={dataLavorateA} />
          ) : null}
          {lavorateFascia ? (
            <input type="hidden" name="lavorateFascia" value={lavorateFascia} />
          ) : null}

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
                  <option value="">Tutte</option>
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
                  <option value="">Tutte</option>
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
                  <option value="">No</option>
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
                  <option value="">Tutti</option>
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
                  <option value="">Tutti</option>
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
                  <option value="">Tutti (in lavorazione)</option>
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
              <Field label="Cod. scarico">
                <CodScaricoFiltroControls
                  codScarico={a.codScarico}
                  codScaricoOp={a.codScaricoOp}
                  fieldClass={modalField}
                  mandatoId={modalMandato}
                  codiciDisponibili={codiciScaricoModal}
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
            <Link
              href="/pratiche"
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
