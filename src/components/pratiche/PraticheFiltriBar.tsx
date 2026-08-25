"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { STATO_LABELS } from "@/lib/permissions";
import { ESITO_CONTATTO_LABELS } from "@/lib/contatto";
import { formatDataIso, startOfToday } from "@/lib/lavorateOggi";
import { CODICI_SCARICO, CODICE_SCARICO_LABELS } from "@/lib/scarico";
import { hasAltriFiltri, type AltriFiltri } from "@/lib/praticheAltriFiltri";

const modalField =
  "h-9 w-full rounded border border-[var(--line)] px-2 text-sm text-[var(--navy)]";
const modalLabel = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";

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

function SezioneFiltri({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-[var(--line)] pb-5 last:border-b-0 last:pb-0">
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
  esito,
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
  altri,
}: {
  q?: string;
  stato?: string;
  esito?: string;
  lavorate?: boolean;
  lavorateData?: string;
  lavorateDa?: string;
  lavorateA?: string;
  lavorateOggi?: boolean;
  lavorateFascia?: "mattina" | "pomeriggio";
  nonToccateDa?: 10;
  sort?: string;
  dir?: string;
  operatori?: Array<{ id: string; name: string }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
  altri?: AltriFiltri;
}) {
  const STATO_DEFAULT = "IN_LAVORAZIONE";
  const [altriFiltriOpen, setAltriFiltriOpen] = useState(false);
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
    esito ||
    lavorate ||
    hasLavorateRange ||
    lavorateFascia ||
    nonToccateDa ||
    hasAltriFiltri(altri)
  );
  const a = altri || {};

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
      <form method="get" action="/pratiche" className="flex flex-wrap gap-2">
        {hiddenNav}
        {/* Conserva filtri avanzati quando si usa solo la barra rapida */}
        {hasAltriFiltri(altri)
          ? (
              [
                "debitore",
                "capDa",
                "capA",
                "citta",
                "prov",
                "telefono",
                "affidoDa",
                "affidoA",
                "scadenzaDa",
                "scadenzaA",
                "mandato",
                "lotto",
                "operatore",
                "codScarico",
                "sitAffido",
                "affidoProvvisorio",
                "importoRataDa",
                "importoRataA",
                "residuoDa",
                "residuoA",
                "totIncassatoDa",
                "totIncassatoA",
                "importoTotDa",
                "importoTotA",
                "cfPiva",
                "garante",
                "note",
                "nPraticaDa",
                "nPraticaA",
                "promPagDa",
                "promPagA",
                "incassatoDa",
                "incassatoA",
                "memoDa",
                "memoA",
                "rateScadute",
                "aggiuntivo",
              ] as const
            ).map((k) =>
              a[k] ? <input key={k} type="hidden" name={k} value={a[k]} /> : null
            )
          : null}

        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca in anagrafica ed estratto conto"
          className="h-10 min-w-0 w-full flex-1 rounded-lg border border-[var(--line)] px-3 text-sm sm:min-w-56"
        />
        <select
          name="stato"
          defaultValue={stato || ""}
          className="h-10 min-w-0 w-full rounded-lg border border-[var(--line)] px-3 text-sm sm:w-auto"
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(STATO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="esito"
          defaultValue={esito || ""}
          className="h-10 min-w-0 w-full rounded-lg border border-[var(--line)] px-3 text-sm sm:w-auto"
        >
          <option value="">Tutti gli esiti contatto</option>
          {Object.entries(ESITO_CONTATTO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2 text-sm sm:px-3">
          <span className="whitespace-nowrap text-[var(--muted)]">Lavorate dal</span>
          <input
            type="date"
            name="lavorateDa"
            defaultValue={dataLavorateDa || ""}
            className="h-8 min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--navy)]"
          />
          <span className="text-[var(--muted)]">al</span>
          <input
            type="date"
            name="lavorateA"
            defaultValue={dataLavorateA || ""}
            className="h-8 min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--navy)]"
          />
        </label>
        <select
          name="lavorateFascia"
          defaultValue={lavorateFascia || ""}
          className="h-10 min-w-0 w-full rounded-lg border border-[var(--line)] px-3 text-sm sm:w-auto"
          title="Fascia oraria lavorazione"
        >
          <option value="">Tutta la giornata</option>
          <option value="mattina">Mattina (09:00–13:00)</option>
          <option value="pomeriggio">Pomeriggio (13:05–18:00)</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
        >
          Filtra
        </button>
        <button
          type="button"
          onClick={() => setAltriFiltriOpen(true)}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm hover:bg-[#eef4f8] ${
            hasAltriFiltri(altri)
              ? "border-[var(--navy)]/40 bg-[#e8eef4] font-medium text-[var(--navy)]"
              : "border-[var(--line)] bg-white"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 text-[var(--muted)]" />
          Altri filtri
        </button>
        {hasFilters ? (
          <Link
            href="/pratiche"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--danger)]/30 bg-[#fef2f2] px-4 text-sm text-[var(--danger)] hover:bg-[#fee2e2]"
          >
            <X className="h-4 w-4" />
            Annulla filtri
          </Link>
        ) : null}
      </form>
      </div>

      {hasLavorateRange ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Filtro attivo: ultima lavorazione (operatore/supervisor)
          {dataLavorateDa && dataLavorateA
            ? ` dal ${new Date(dataLavorateDa + "T12:00:00").toLocaleDateString("it-IT")} al ${new Date(dataLavorateA + "T12:00:00").toLocaleDateString("it-IT")}`
            : dataLavorateDa
              ? ` dal ${new Date(dataLavorateDa + "T12:00:00").toLocaleDateString("it-IT")} in poi`
              : ` fino al ${new Date(dataLavorateA! + "T12:00:00").toLocaleDateString("it-IT")}`}
          {lavorateFascia === "mattina"
            ? " (mattina 09:00–13:00)"
            : lavorateFascia === "pomeriggio"
              ? " (pomeriggio 13:05–18:00)"
              : ""}
          .
        </p>
      ) : lavorateFascia ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Filtro attivo: lavorazioni di oggi in fascia{" "}
          {lavorateFascia === "mattina" ? "mattina (09:00–13:00)" : "pomeriggio (13:05–18:00)"}.
        </p>
      ) : null}
      {nonToccateDa ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Filtro attivo: pratiche dormienti (aperte, non aggiornate da almeno{" "}
          {nonToccateDa} giorni; escluse le promesse con data successiva a oggi).
        </p>
      ) : null}
      {a.promPagDa || a.promPagA ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Filtro attivo: data promessa di pagamento
          {a.promPagDa && a.promPagA
            ? ` dal ${new Date(a.promPagDa + "T12:00:00").toLocaleDateString("it-IT")} al ${new Date(a.promPagA + "T12:00:00").toLocaleDateString("it-IT")}`
            : a.promPagDa
              ? ` dal ${new Date(a.promPagDa + "T12:00:00").toLocaleDateString("it-IT")} in poi`
              : ` fino al ${new Date(a.promPagA! + "T12:00:00").toLocaleDateString("it-IT")}`}
          .
        </p>
      ) : null}

      <Modal
        open={altriFiltriOpen}
        title="Altri filtri"
        onClose={() => setAltriFiltriOpen(false)}
        wide
      >
        <form method="get" action="/pratiche" className="space-y-4 p-4">
          {hiddenNav}
          <input type="hidden" name="q" value={q || ""} />
          <input type="hidden" name="stato" value={stato || ""} />
          <input type="hidden" name="esito" value={esito || ""} />
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
            <SezioneFiltri title="Filtri anagrafica">
              <Field label="Debitore">
                <input
                  name="debitore"
                  defaultValue={a.debitore || ""}
                  placeholder="Nome / cognome"
                  className={modalField}
                />
              </Field>
              <Field label="Città">
                <input
                  name="citta"
                  defaultValue={a.citta || ""}
                  placeholder="Città debitore"
                  className={modalField}
                />
              </Field>
              <Field label="Prov.">
                <input
                  name="prov"
                  defaultValue={a.prov || ""}
                  placeholder="Provincia"
                  className={modalField}
                />
              </Field>
              <Field label="Telefono">
                <input
                  name="telefono"
                  defaultValue={a.telefono || ""}
                  placeholder="Telefono"
                  className={modalField}
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
                <input
                  name="cfPiva"
                  defaultValue={a.cfPiva || ""}
                  placeholder="Codice fiscale"
                  className={modalField}
                />
              </Field>
              <Field label="Garante">
                <input
                  name="garante"
                  defaultValue={a.garante || ""}
                  placeholder="Nome / CF garante"
                  className={modalField}
                />
              </Field>
              <Field label="Note">
                <input
                  name="note"
                  defaultValue={a.note || ""}
                  placeholder="Testo in note / attività"
                  className={modalField}
                />
              </Field>
            </SezioneFiltri>

            <SezioneFiltri title="Filtri contabili">
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

            <SezioneFiltri title="Filtri codici">
              <Field label="Operatore di affido">
                <select name="operatore" defaultValue={a.operatore || ""} className={modalField}>
                  <option value="">Tutti</option>
                  {(operatori || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sit. affido">
                <select name="sitAffido" defaultValue={a.sitAffido || ""} className={modalField}>
                  <option value="">Tutte</option>
                  <option value="affidata">Affidata</option>
                  <option value="non_affidata">Non affidata</option>
                  <option value="temporanea">Affido temporaneo</option>
                </select>
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
                <select name="mandato" defaultValue={a.mandato || ""} className={modalField}>
                  <option value="">Tutti</option>
                  {(mandanti || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codice} — {m.ragioneSociale}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Perimetro / Lotto">
                <select name="lotto" defaultValue={a.lotto || ""} className={modalField}>
                  <option value="">Tutti (in lavorazione)</option>
                  {(lotti || []).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                  {a.lotto && !(lotti || []).includes(a.lotto) ? (
                    <option value={a.lotto}>{a.lotto} (chiuso)</option>
                  ) : null}
                </select>
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
                <select name="codScarico" defaultValue={a.codScarico || ""} className={modalField}>
                  <option value="">Tutti</option>
                  {CODICI_SCARICO.map((c) => (
                    <option key={c} value={c}>
                      {c} — {CODICE_SCARICO_LABELS[c]}
                    </option>
                  ))}
                </select>
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
                <select name="aggiuntivo" defaultValue={a.aggiuntivo || ""} className={modalField}>
                  <option value="">—</option>
                </select>
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
