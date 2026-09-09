"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { definisciStrategiaAction } from "@/actions/giudiziale";
import {
  PARERI_VALUTAZIONE,
  TIPI_AZIONE_IPOTIZZATA,
  TRISTATO_TITOLO,
} from "@/lib/giudiziale/valutazioneLegale";

const fieldCls =
  "h-9 w-full rounded-lg border border-[#7d94a8] bg-white px-2 text-sm text-[var(--navy)]";
const labelCls = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";
const sectionCls =
  "space-y-3 rounded-lg border border-[var(--line)]/70 bg-[#f8fafc] p-3";
const areaCls =
  "w-full rounded-lg border border-[#7d94a8] bg-white px-2 py-1.5 text-sm text-[var(--navy)]";

export type ValutazioneLegaleInitial = {
  titoloCreditoEsistenza?: string;
  titoloCreditoValidita?: string;
  titoloCreditoEsigibilita?: string;
  prescrizioneTermini?: string;
  documentazioneProve?: string;
  contestazioniDebitore?: string;
  solvibilitaRecupero?: string;
  giudiceCompetente?: string;
  foroEventuale?: string;
  tipoAzioneIpotizzata?: string;
  tipoAzioneAltroDettaglio?: string;
  costiBenefici?: string;
  rischiLegali?: string;
  parereValutazione?: string;
  parereMotivazione?: string;
  valutazioneCompletataAt?: string | null;
};

export function ValutazioneLegaleForm({
  praticaId,
  initial,
  readOnly,
}: {
  praticaId: string;
  initial?: ValutazioneLegaleInitial;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [esistenza, setEsistenza] = useState(initial?.titoloCreditoEsistenza || "");
  const [validita, setValidita] = useState(initial?.titoloCreditoValidita || "");
  const [esigibilita, setEsigibilita] = useState(initial?.titoloCreditoEsigibilita || "");
  const [prescrizione, setPrescrizione] = useState(initial?.prescrizioneTermini || "");
  const [documentazione, setDocumentazione] = useState(initial?.documentazioneProve || "");
  const [contestazioni, setContestazioni] = useState(initial?.contestazioniDebitore || "");
  const [solvibilita, setSolvibilita] = useState(initial?.solvibilitaRecupero || "");
  const [giudice, setGiudice] = useState(initial?.giudiceCompetente || "");
  const [foro, setForo] = useState(initial?.foroEventuale || "");
  const [tipoAzione, setTipoAzione] = useState(initial?.tipoAzioneIpotizzata || "");
  const [tipoAltro, setTipoAltro] = useState(initial?.tipoAzioneAltroDettaglio || "");
  const [costi, setCosti] = useState(initial?.costiBenefici || "");
  const [rischi, setRischi] = useState(initial?.rischiLegali || "");
  const [parere, setParere] = useState(initial?.parereValutazione || "");
  const [motivazione, setMotivazione] = useState(initial?.parereMotivazione || "");

  const disabled = readOnly || pending;

  const payload = useMemo(
    () => ({
      praticaId,
      titoloCreditoEsistenza: esistenza || null,
      titoloCreditoValidita: validita || null,
      titoloCreditoEsigibilita: esigibilita || null,
      prescrizioneTermini: prescrizione,
      documentazioneProve: documentazione,
      contestazioniDebitore: contestazioni,
      solvibilitaRecupero: solvibilita,
      giudiceCompetente: giudice,
      foroEventuale: foro,
      tipoAzioneIpotizzata: tipoAzione || null,
      tipoAzioneAltroDettaglio: tipoAltro,
      costiBenefici: costi,
      rischiLegali: rischi,
      parereValutazione: parere || null,
      parereMotivazione: motivazione,
    }),
    [
      praticaId,
      esistenza,
      validita,
      esigibilita,
      prescrizione,
      documentazione,
      contestazioni,
      solvibilita,
      giudice,
      foro,
      tipoAzione,
      tipoAltro,
      costi,
      rischi,
      parere,
      motivazione,
    ]
  );

  function submit() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const result = await definisciStrategiaAction(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOk(result.ok || "Salvato");
      if (result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">Analisi della posizione</h2>

        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          Titolo del credito
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Esistenza</span>
            <select
              value={esistenza}
              disabled={disabled}
              onChange={(e) => setEsistenza(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {TRISTATO_TITOLO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Validità</span>
            <select
              value={validita}
              disabled={disabled}
              onChange={(e) => setValidita(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {TRISTATO_TITOLO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Esigibilità</span>
            <select
              value={esigibilita}
              disabled={disabled}
              onChange={(e) => setEsigibilita(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {TRISTATO_TITOLO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>Prescrizione / termini</span>
          <textarea
            value={prescrizione}
            disabled={disabled}
            onChange={(e) => setPrescrizione(e.target.value)}
            rows={3}
            className={areaCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Documentazione e prove</span>
          <textarea
            value={documentazione}
            disabled={disabled}
            onChange={(e) => setDocumentazione(e.target.value)}
            rows={3}
            className={areaCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Eventuali contestazioni del debitore</span>
          <textarea
            value={contestazioni}
            disabled={disabled}
            onChange={(e) => setContestazioni(e.target.value)}
            rows={3}
            className={areaCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Solvibilità / possibilità di recupero</span>
          <textarea
            value={solvibilita}
            disabled={disabled}
            onChange={(e) => setSolvibilita(e.target.value)}
            rows={3}
            className={areaCls}
          />
        </label>
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">Competenza</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Giudice competente</span>
            <input
              value={giudice}
              disabled={disabled}
              onChange={(e) => setGiudice(e.target.value)}
              className={fieldCls}
              placeholder="Es. Tribunale di …"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Eventuale foro</span>
            <input
              value={foro}
              disabled={disabled}
              onChange={(e) => setForo(e.target.value)}
              className={fieldCls}
            />
          </label>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">Tipo di azione ipotizzata *</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {TIPI_AZIONE_IPOTIZZATA.map((t) => (
            <label key={t.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="tipoAzione"
                value={t.value}
                disabled={disabled}
                checked={tipoAzione === t.value}
                onChange={() => setTipoAzione(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
        {tipoAzione === "ALTRA_PROCEDURA" ? (
          <label className="mt-2 block">
            <span className={labelCls}>Descrizione altra procedura *</span>
            <input
              value={tipoAltro}
              disabled={disabled}
              onChange={(e) => setTipoAltro(e.target.value)}
              className={fieldCls}
            />
          </label>
        ) : null}
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">Valutazione costi/benefici</h2>
        <textarea
          value={costi}
          disabled={disabled}
          onChange={(e) => setCosti(e.target.value)}
          rows={3}
          className={areaCls}
        />
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">Rischi legali</h2>
        <textarea
          value={rischi}
          disabled={disabled}
          onChange={(e) => setRischi(e.target.value)}
          rows={3}
          className={areaCls}
        />
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">Parere *</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {PARERI_VALUTAZIONE.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="parere"
                value={p.value}
                disabled={disabled}
                checked={parere === p.value}
                onChange={() => setParere(p.value)}
              />
              {p.label}
            </label>
          ))}
        </div>
        <label className="mt-2 block">
          <span className={labelCls}>Motivazione del parere *</span>
          <textarea
            value={motivazione}
            disabled={disabled}
            onChange={(e) => setMotivazione(e.target.value)}
            rows={4}
            className={areaCls}
          />
        </label>
      </section>

      {error ? (
        <p className="rounded border border-[var(--danger)]/30 bg-[#fef2f2] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {ok}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            disabled={disabled}
            onClick={submit}
            className="h-10 rounded-lg bg-[var(--navy)] px-5 text-sm font-bold uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-50"
          >
            Definisci strategia
          </button>
        </div>
      ) : null}
    </div>
  );
}
