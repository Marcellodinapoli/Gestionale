"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { confermaAvvioGiudizialeAction } from "@/actions/giudiziale";
import {
  MOTIVI_PASSAGGIO_GIUDIZIALE,
  TRISTATO_VERIFICA,
  VALUTAZIONE_RECUPERABILITA,
  isStatoAvvioChiuso,
  labelStatoAvvio,
  type AzioneAvvioGiudiziale,
} from "@/lib/giudiziale/avvioGiudiziale";

type ReferenteOpt = { id: string; name: string };

const fieldCls =
  "h-9 w-full rounded-lg border border-[#7d94a8] bg-white px-2 text-sm text-[var(--navy)]";
const labelCls = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";
const sectionCls =
  "space-y-3 rounded-lg border border-[var(--line)]/70 bg-[#f8fafc] p-3";

export function AvvioGiudizialeForm({
  praticaId,
  referentiInterni,
  initial,
  readOnly,
}: {
  praticaId: string;
  referentiInterni: ReferenteOpt[];
  initial?: {
    statoAvvio?: string | null;
    dataAffidamentoGiudiziale?: string;
    studioLegale?: string;
    avvocatoReferente?: string;
    referenteInternoId?: string;
    noteAffidamento?: string;
    motivoPassaggio?: string;
    motivoAltroDettaglio?: string;
    documentazioneDisponibile?: string;
    prescrizioneVerificata?: string;
    anagraficaDebitoreVerificata?: string;
    valutazioneRecuperabilita?: string;
    noteVerifica?: string;
  };
  readOnly?: boolean;
}) {
  const router = useRouter();
  const closed = readOnly || isStatoAvvioChiuso(initial?.statoAvvio);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [archiviaOpen, setArchiviaOpen] = useState(false);
  const [motivazioneArchiviazione, setMotivazioneArchiviazione] = useState("");
  const [noteArchiviazione, setNoteArchiviazione] = useState("");
  const [archiviaError, setArchiviaError] = useState<string | null>(null);

  const [dataAffidamento, setDataAffidamento] = useState(
    initial?.dataAffidamentoGiudiziale || ""
  );
  const [studioLegale, setStudioLegale] = useState(initial?.studioLegale || "");
  const [avvocato, setAvvocato] = useState(initial?.avvocatoReferente || "");
  const [referenteId, setReferenteId] = useState(initial?.referenteInternoId || "");
  const [noteAff, setNoteAff] = useState(initial?.noteAffidamento || "");
  const [motivo, setMotivo] = useState(initial?.motivoPassaggio || "");
  const [motivoAltro, setMotivoAltro] = useState(initial?.motivoAltroDettaglio || "");
  const [docDisp, setDocDisp] = useState(initial?.documentazioneDisponibile || "");
  const [prescr, setPrescr] = useState(initial?.prescrizioneVerificata || "");
  const [anag, setAnag] = useState(initial?.anagraficaDebitoreVerificata || "");
  const [valut, setValut] = useState(initial?.valutazioneRecuperabilita || "");
  const [noteVer, setNoteVer] = useState(initial?.noteVerifica || "");

  const disabled = closed || pending;

  const payloadBase = useMemo(
    () => ({
      praticaId,
      dataAffidamentoGiudiziale: dataAffidamento || null,
      studioLegale,
      avvocatoReferente: avvocato,
      referenteInternoId: referenteId || null,
      noteAffidamento: noteAff,
      motivoPassaggio: motivo || null,
      motivoAltroDettaglio: motivoAltro,
      documentazioneDisponibile: docDisp || null,
      prescrizioneVerificata: prescr || null,
      anagraficaDebitoreVerificata: anag || null,
      valutazioneRecuperabilita: valut || null,
      noteVerifica: noteVer,
    }),
    [
      praticaId,
      dataAffidamento,
      studioLegale,
      avvocato,
      referenteId,
      noteAff,
      motivo,
      motivoAltro,
      docDisp,
      prescr,
      anag,
      valut,
      noteVer,
    ]
  );

  function clientValidateBeforeAction(azione: AzioneAvvioGiudiziale): string | null {
    if (!dataAffidamento.trim()) return "Indica la data di affidamento giudiziale";
    if (!motivo) return "Seleziona il motivo del passaggio al giudiziale";
    if (motivo === "ALTRO" && !motivoAltro.trim()) {
      return "Descrivi il motivo (campo obbligatorio se scegli Altro)";
    }
    if (azione === "ARCHIVIA_SENZA_AZIONE" && !motivazioneArchiviazione.trim()) {
      return "Indica la motivazione dell'archiviazione";
    }
    return null;
  }

  function submit(
    azione: AzioneAvvioGiudiziale,
    extra?: { motivazioneArchiviazione?: string; noteArchiviazione?: string }
  ) {
    const localErr = clientValidateBeforeAction(azione);
    if (localErr) {
      if (azione === "ARCHIVIA_SENZA_AZIONE") setArchiviaError(localErr);
      else setError(localErr);
      return;
    }
    setError(null);
    setOk(null);
    setArchiviaError(null);
    startTransition(async () => {
      const result = await confermaAvvioGiudizialeAction({
        ...payloadBase,
        azione,
        motivazioneArchiviazione: extra?.motivazioneArchiviazione ?? null,
        noteArchiviazione: extra?.noteArchiviazione ?? null,
      });
      if (result.error) {
        if (azione === "ARCHIVIA_SENZA_AZIONE") setArchiviaError(result.error);
        else setError(result.error);
        return;
      }
      setOk(result.ok || "Salvato");
      setArchiviaOpen(false);
      if (result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  }

  function openArchiviaModal() {
    setError(null);
    const pre = clientValidateBeforeAction("RICHIEDI_VALUTAZIONE");
    if (pre) {
      setError(pre);
      return;
    }
    setArchiviaError(null);
    setArchiviaOpen(true);
  }

  return (
    <div className="space-y-4">
      {closed ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Avvio già concluso: <strong>{labelStatoAvvio(initial?.statoAvvio)}</strong>. I
          campi sono in sola lettura.
        </p>
      ) : null}

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">
          Dati dell&apos;affidamento giudiziale
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Data affidamento giudiziale *</span>
            <input
              type="date"
              value={dataAffidamento}
              disabled={disabled}
              onChange={(e) => setDataAffidamento(e.target.value)}
              className={fieldCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Studio legale</span>
            <input
              value={studioLegale}
              disabled={disabled}
              onChange={(e) => setStudioLegale(e.target.value)}
              className={fieldCls}
              placeholder="Nome studio"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Avvocato / referente legale</span>
            <input
              value={avvocato}
              disabled={disabled}
              onChange={(e) => setAvvocato(e.target.value)}
              className={fieldCls}
              placeholder="Nome e cognome"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className={labelCls}>Referente interno</span>
            <select
              value={referenteId}
              disabled={disabled}
              onChange={(e) => setReferenteId(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {referentiInterni.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className={labelCls}>Note sull&apos;affidamento</span>
            <textarea
              value={noteAff}
              disabled={disabled}
              onChange={(e) => setNoteAff(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#7d94a8] bg-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">
          Motivo del passaggio al giudiziale *
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {MOTIVI_PASSAGGIO_GIUDIZIALE.map((m) => (
            <label key={m.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="motivo"
                value={m.value}
                disabled={disabled}
                checked={motivo === m.value}
                onChange={() => setMotivo(m.value)}
              />
              {m.label}
            </label>
          ))}
        </div>
        {motivo === "ALTRO" ? (
          <label className="mt-2 block">
            <span className={labelCls}>Descrizione motivo *</span>
            <input
              value={motivoAltro}
              disabled={disabled}
              onChange={(e) => setMotivoAltro(e.target.value)}
              className={fieldCls}
              placeholder="Specifica il motivo"
            />
          </label>
        ) : null}
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-bold text-[var(--navy)]">Verifica preliminare</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Documentazione disponibile</span>
            <select
              value={docDisp}
              disabled={disabled}
              onChange={(e) => setDocDisp(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {TRISTATO_VERIFICA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Prescrizione verificata</span>
            <select
              value={prescr}
              disabled={disabled}
              onChange={(e) => setPrescr(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {TRISTATO_VERIFICA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Anagrafica debitore verificata</span>
            <select
              value={anag}
              disabled={disabled}
              onChange={(e) => setAnag(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {TRISTATO_VERIFICA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className={labelCls}>Valutazione preliminare recuperabilità</span>
            <select
              value={valut}
              disabled={disabled}
              onChange={(e) => setValut(e.target.value)}
              className={fieldCls}
            >
              <option value="">—</option>
              {VALUTAZIONE_RECUPERABILITA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className={labelCls}>Note</span>
            <textarea
              value={noteVer}
              disabled={disabled}
              onChange={(e) => setNoteVer(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#7d94a8] bg-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>
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

      {!closed ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            disabled={disabled}
            onClick={openArchiviaModal}
            className="h-10 rounded-lg border border-[#7d94a8] bg-white px-4 text-sm font-semibold text-[var(--navy)] hover:bg-[#eef4f8] disabled:opacity-50"
          >
            Archivia senza azione giudiziale
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => submit("RICHIEDI_VALUTAZIONE")}
            className="h-10 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Richiedi valutazione legale
          </button>
        </div>
      ) : null}

      <Modal
        open={archiviaOpen}
        title="Conferma archiviazione senza azione giudiziale"
        onClose={() => {
          if (pending) return;
          setArchiviaOpen(false);
          setArchiviaError(null);
        }}
      >
        <div className="space-y-3 p-4">
          <p className="text-sm text-[var(--muted)]">
            La pratica non verrà cancellata. Verrà chiusa la valutazione giudiziale senza
            avviare procedure; resta consultabile con lo storico stragiudiziale.
          </p>
          <label className="block">
            <span className={labelCls}>Motivazione archiviazione *</span>
            <textarea
              value={motivazioneArchiviazione}
              disabled={pending}
              onChange={(e) => setMotivazioneArchiviazione(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#7d94a8] bg-white px-2 py-1.5 text-sm"
              placeholder="Perché non si procede giudizialmente"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Note aggiuntive</span>
            <textarea
              value={noteArchiviazione}
              disabled={pending}
              onChange={(e) => setNoteArchiviazione(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[#7d94a8] bg-white px-2 py-1.5 text-sm"
            />
          </label>
          {archiviaError ? (
            <p className="rounded border border-[var(--danger)]/30 bg-[#fef2f2] px-3 py-2 text-sm text-[var(--danger)]">
              {archiviaError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setArchiviaOpen(false);
                setArchiviaError(null);
              }}
              className="h-9 rounded-lg border border-[#7d94a8] bg-white px-4 text-sm font-semibold text-[var(--navy)] hover:bg-[#eef4f8] disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                submit("ARCHIVIA_SENZA_AZIONE", {
                  motivazioneArchiviazione,
                  noteArchiviazione,
                })
              }
              className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Conferma archiviazione
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
