"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import {
  aggiornaStatoCandidaturaAction,
  aggiungiNotaCandidaturaAction,
  creaColloquioAction,
  creaProvaAction,
  eliminaCandidaturaAction,
  getIndeedCandidateCvUrlAction,
  modificaContattoCandidaturaAction,
  registraContattoCandidaturaAction,
} from "@/actions/recruiting";
import {
  STATO_CANDIDATURA_LABELS,
  transizioniConsentiteCandidatura,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";
import {
  CANALE_CONTATTO_LABELS,
  CANALI_CONTATTO,
  ESITI_CONTATTO,
  ESITO_CONTATTO_LABELS,
  ESITO_PROVA_LABELS,
  isEsitoContatto,
  messaggioConfermaStatoTerminale,
  type EsitoContatto,
  type EsitoProva,
  type SuggerimentoTransizione,
} from "@/lib/recruiting/attivita";
import {
  ESITO_COLLOQUIO_LABELS,
  MODALITA_COLLOQUIO,
  MODALITA_COLLOQUIO_LABELS,
  type EsitoColloquio,
} from "@/lib/recruiting/colloqui";
import {
  formatOrigineCandidatura,
  isTemporaryCvUrlValid,
  mapCvOpenUserMessage,
} from "@/lib/recruiting/cvOpenUi";

const STEPS_PRINCIPALI: StatoCandidatura[] = [
  "RICEVUTA",
  "COLLOQUIO",
  "PROVA",
  "ASSUNTA",
];

const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";
const btnOutline =
  "h-9 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold disabled:opacity-50";

function datetimeLocalValue(iso?: string) {
  const parsed = iso ? new Date(iso) : new Date();
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function etichettaAzioneStato(stato: StatoCandidatura): string {
  if (stato === "COLLOQUIO") return "Passa a Colloquio";
  if (stato === "PROVA") return "Passa a Prova";
  if (stato === "ASSUNTA") return "Assunto/a";
  if (stato === "ARCHIVIATA") return "Archivia candidatura";
  return STATO_CANDIDATURA_LABELS[stato];
}

function classeStep(kind: "done" | "current" | "future" | "archive") {
  if (kind === "current") {
    return "bg-[var(--navy)] text-white ring-2 ring-[var(--navy)] ring-offset-2";
  }
  if (kind === "done") return "bg-emerald-100 text-emerald-900";
  if (kind === "archive") return "bg-stone-700 text-white";
  return "bg-slate-100 text-slate-500";
}

function percorsoIdx(stato: StatoCandidatura): number {
  // Legacy: candidature ancora «In valutazione» restano sul primo step operativo.
  if (stato === "IN_VALUTAZIONE") return STEPS_PRINCIPALI.indexOf("RICEVUTA");
  return STEPS_PRINCIPALI.indexOf(stato);
}

function PercorsoCandidatura({ stato }: { stato: StatoCandidatura }) {
  const currentIdx = percorsoIdx(stato);
  const archiviata = stato === "ARCHIVIATA";

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Percorso</p>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {STEPS_PRINCIPALI.map((step, idx) => {
          let kind: "done" | "current" | "future" = "future";
          if (!archiviata && currentIdx >= 0) {
            if (idx < currentIdx) kind = "done";
            else if (idx === currentIdx) kind = "current";
          }
          return (
            <li key={step} className="flex items-center gap-1.5">
              {idx > 0 ? (
                <span className="text-slate-300" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${classeStep(kind)}`}
                aria-current={kind === "current" ? "step" : undefined}
              >
                {STATO_CANDIDATURA_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[var(--muted)]">Alternativa:</span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
            archiviata ? classeStep("archive") : classeStep("future")
          }`}
          aria-current={archiviata ? "step" : undefined}
        >
          {STATO_CANDIDATURA_LABELS.ARCHIVIATA}
        </span>
      </p>
    </div>
  );
}

function etichettaEsitoContattoScheda(esito: string, fase: "colloquio" | "prova"): string | null {
  if (esito === "RIFIUTA") return "Il candidato ha rifiutato il contatto.";
  if (esito === "NON_RAGGIUNTO") return "Il candidato non è stato raggiunto.";
  if (esito === "DA_RICHIAMARE") return "Il candidato è da richiamare.";
  if (esito === "RAGGIUNTO") {
    return fase === "prova"
      ? "Candidato raggiunto: puoi programmare la prova."
      : "Candidato raggiunto: puoi programmare il colloquio.";
  }
  return null;
}

function etichettaEsitoColloquioScheda(esito: EsitoColloquio | null): string {
  if (!esito) return "Registra l’esito del colloquio.";
  if (esito === "POSITIVO") return "Contatta il candidato per programmare la prova.";
  if (esito === "DA_RIVALUTARE") return "Puoi programmare un nuovo colloquio oppure contattare il candidato.";
  if (esito === "NEGATIVO" || esito === "ASSENTE") return "Valuta se archiviare la candidatura.";
  return "Contatta il candidato.";
}

function etichettaEsitoProvaScheda(esito: EsitoProva | null): string {
  if (!esito) return "Registra l’esito della prova.";
  if (esito === "POSITIVO") return "Puoi passare ad Assunto/a.";
  if (esito === "DA_RIVALUTARE") return "Esito da rivalutare: aggiorna la prova o archivia.";
  if (esito === "NEGATIVO" || esito === "ASSENTE") return "Valuta se archiviare la candidatura.";
  return "Completa la valutazione della prova.";
}

type BannerFase = {
  titoloEsito: string;
  valoreEsito: string;
  indicazione: string;
  tone: "neutral" | "ok" | "warn" | "danger";
};

function classeBottoneStato(stato: StatoCandidatura, primaria: boolean): string {
  const base = "h-9 rounded-lg px-3 text-sm font-semibold disabled:opacity-50";
  if (stato === "ASSUNTA") {
    return primaria
      ? `${base} bg-emerald-700 text-white`
      : `${base} border border-emerald-700 text-emerald-800`;
  }
  if (stato === "ARCHIVIATA") {
    return primaria
      ? `${base} bg-rose-800 text-white`
      : `${base} border border-rose-300 text-rose-800`;
  }
  return primaria
    ? `${base} bg-[var(--navy)] text-white`
    : `${base} border border-[var(--line)] bg-white`;
}

export function CandidaturaDettaglioClient({
  candidatura,
  offerta,
  canManage,
  canViewCv = false,
  operabile,
  canCreateColloquio,
  colloquioProgrammatoId = null,
  utenti,
  supervisori,
  suggerimento,
  hasColloquiAperti,
  contatto,
  ultimoColloquio = null,
  ultimaProva = null,
}: {
  candidatura: {
    id: string;
    stato: StatoCandidatura;
    cognome: string;
    nome: string;
    email?: string | null;
    phone?: string | null;
    coverLetter?: string | null;
    source?: string | null;
    receivedAt?: string | null;
    receiverCandidateId?: string | null;
    cvFileName?: string | null;
  };
  offerta?: { id: string; titolo: string } | null;
  canManage: boolean;
  /** True se l'utente può richiedere l'URL CV al Receiver. */
  canViewCv?: boolean;
  operabile: boolean;
  canCreateColloquio: boolean;
  colloquioProgrammatoId?: string | null;
  utenti: Array<{ id: string; name: string }>;
  supervisori: Array<{ id: string; name: string }>;
  suggerimento: SuggerimentoTransizione | null;
  hasColloquiAperti: boolean;
  contatto: {
    id: string;
    canale: string;
    esito: string;
    occurredAt: string;
    note: string;
  } | null;
  ultimoColloquio?: {
    id: string;
    esito: EsitoColloquio | null;
    stato: string;
    valutazioneStelle: number | null;
    noteSvolgimento: string;
  } | null;
  ultimaProva?: {
    id: string;
    esito: EsitoProva | null;
    valutazioneStelle: number | null;
    parere: string;
  } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmTo, setConfirmTo] = useState<"ASSUNTA" | "ARCHIVIATA" | null>(null);
  const [modal, setModal] = useState<"colloquio" | "prova" | "nota" | null>(null);
  const [esitoContattoForm, setEsitoContattoForm] = useState<EsitoContatto | "">("");
  /** Fase pre-colloquio: Candidatura (attivo) o In valutazione (legacy). */
  const inPreColloquio =
    candidatura.stato === "RICEVUTA" || candidatura.stato === "IN_VALUTAZIONE";
  const inColloquio = candidatura.stato === "COLLOQUIO";
  const inProva = candidatura.stato === "PROVA";
  const hasContatto = Boolean(contatto);
  const modificaContatto = (inPreColloquio || inColloquio) && hasContatto;
  const colloquioObbligatorio = inPreColloquio;
  const provaObbligatoria = candidatura.stato === "COLLOQUIO";
  const esitoContattoSelezionato = esitoContattoForm !== "";
  const canProgrammareColloquio =
    !inPreColloquio || esitoContattoForm === "RAGGIUNTO";
  const canProgrammareProva =
    !inColloquio || esitoContattoForm === "RAGGIUNTO";
  const canSalvareContattoColloquio =
    !inPreColloquio || esitoContattoSelezionato;
  const canSalvareContattoProva =
    !inColloquio || esitoContattoSelezionato;

  const bannerFase: BannerFase | null = (() => {
    if (inPreColloquio) {
      const esitoLabel = !contatto
        ? "Da contattare"
        : isEsitoContatto(contatto.esito)
          ? ESITO_CONTATTO_LABELS[contatto.esito as EsitoContatto]
          : contatto.esito || "—";
      const indicazione =
        (!contatto
          ? "Contatta il candidato per programmare il colloquio."
          : etichettaEsitoContattoScheda(contatto.esito, "colloquio")) ||
        "Contatta il candidato.";
      return {
        titoloEsito: "Esito contatto",
        valoreEsito: esitoLabel,
        indicazione,
        tone: !contatto
          ? "neutral"
          : contatto.esito === "RIFIUTA"
            ? "danger"
            : contatto.esito === "RAGGIUNTO"
              ? "ok"
              : "warn",
      };
    }
    if (inColloquio) {
      const esitoCol = ultimoColloquio?.esito ?? null;
      const esitoLabel = esitoCol ? ESITO_COLLOQUIO_LABELS[esitoCol] : "Da registrare";
      // Contatto della fase Colloquio (per programmare la prova)
      if (contatto) {
        const indicazioneContatto =
          etichettaEsitoContattoScheda(contatto.esito, "prova") ||
          etichettaEsitoColloquioScheda(esitoCol);
        return {
          titoloEsito: "Esito del colloquio",
          valoreEsito: esitoLabel,
          indicazione: indicazioneContatto,
          tone:
            esitoCol === "NEGATIVO" || esitoCol === "ASSENTE"
              ? "danger"
              : esitoCol === "POSITIVO" || contatto.esito === "RAGGIUNTO"
                ? "ok"
                : "warn",
        };
      }
      return {
        titoloEsito: "Esito del colloquio",
        valoreEsito: esitoLabel,
        indicazione: etichettaEsitoColloquioScheda(esitoCol),
        tone:
          esitoCol === "NEGATIVO" || esitoCol === "ASSENTE"
            ? "danger"
            : esitoCol === "POSITIVO"
              ? "ok"
              : "neutral",
      };
    }
    if (inProva) {
      const esitoPr = ultimaProva?.esito ?? null;
      const esitoLabel = esitoPr ? ESITO_PROVA_LABELS[esitoPr] : "Da registrare";
      return {
        titoloEsito: "Esito prova",
        valoreEsito: esitoLabel,
        indicazione: etichettaEsitoProvaScheda(esitoPr),
        tone:
          esitoPr === "NEGATIVO" || esitoPr === "ASSENTE"
            ? "danger"
            : esitoPr === "POSITIVO"
              ? "ok"
              : esitoPr
                ? "warn"
                : "neutral",
      };
    }
    return null;
  })();

  useEffect(() => {
    if (modal !== "colloquio" && modal !== "prova") return;
    if (modificaContatto && contatto?.esito && isEsitoContatto(contatto.esito)) {
      setEsitoContattoForm(contatto.esito);
    } else {
      setEsitoContattoForm("");
    }
  }, [modal, modificaContatto, contatto?.esito]);
  const next = transizioniConsentiteCandidatura(candidatura.stato);
  const passaA = next.filter(
    (s) =>
      s !== "ARCHIVIATA" &&
      s !== "COLLOQUIO" &&
      s !== "PROVA" &&
      s !== "IN_VALUTAZIONE"
  ) as StatoCandidatura[];
  const canArchivia = next.includes("ARCHIVIATA");
  const primaria: StatoCandidatura | null =
    suggerimento?.to && passaA.includes(suggerimento.to) ? suggerimento.to : null;
  const secondarie = passaA.filter((s) => s !== primaria);
  const showAzioni = canManage;

  const email = String(candidatura.email || "").trim();
  const phone = String(candidatura.phone || "").trim();
  const coverLetter = String(candidatura.coverLetter || "").trim();
  const origine = formatOrigineCandidatura(candidatura.source);
  const receivedLabel = candidatura.receivedAt
    ? new Date(candidatura.receivedAt).toLocaleString("it-IT")
    : null;
  const showCv =
    canViewCv && Boolean(String(candidatura.receiverCandidateId || "").trim());
  const cvFileName = String(candidatura.cvFileName || "").trim();

  function runAction(fd: FormData, action: (data: FormData) => Promise<void>, onOk: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action(fd);
        onOk();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operazione non riuscita");
      }
    });
  }

  function submitStato(stato: StatoCandidatura) {
    const fd = new FormData();
    fd.set("id", candidatura.id);
    fd.set("stato", stato);
    setError(null);
    startTransition(async () => {
      try {
        await aggiornaStatoCandidaturaAction(fd);
        setConfirmTo(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operazione non riuscita");
      }
    });
  }

  function onClickStato(stato: StatoCandidatura) {
    if (stato === "ASSUNTA" || stato === "ARCHIVIATA") {
      setConfirmTo(stato);
      return;
    }
    submitStato(stato);
  }

  async function onVisualizzaCv() {
    setCvError(null);
    setCvLoading(true);
    try {
      // Solo candidaturaId — tenant/receiverCandidateId risolti server-side
      const res = await getIndeedCandidateCvUrlAction(candidatura.id);
      if (!isTemporaryCvUrlValid(res.openUrl, res.expiresAt)) {
        setCvError("Il collegamento al CV non è più valido. Riprova.");
        return;
      }
      window.open(res.openUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setCvError(
        mapCvOpenUserMessage(e instanceof Error ? e.message : "")
      );
    } finally {
      setCvLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--line)] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Cognome</p>
            <p className="text-lg font-semibold text-[var(--navy)]">{candidatura.cognome}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Nome</p>
            <p className="text-lg font-semibold text-[var(--navy)]">{candidatura.nome}</p>
          </div>
          {email ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Email</p>
              <a
                href={`mailto:${email}`}
                className="text-sm font-medium text-[var(--accent)] underline"
              >
                {email}
              </a>
            </div>
          ) : null}
          {phone ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Telefono</p>
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="text-sm font-medium text-[var(--accent)] underline"
              >
                {phone}
              </a>
            </div>
          ) : null}
          {origine ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Origine</p>
              <p className="text-sm text-slate-700">{origine}</p>
            </div>
          ) : null}
          {receivedLabel ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                Data ricezione
              </p>
              <p className="text-sm tabular-nums text-slate-700">{receivedLabel}</p>
            </div>
          ) : null}
        </div>

        {offerta ? (
          <p className="mb-3 text-sm text-[var(--muted)]">
            Offerta:{" "}
            <Link
              href={`/recruiting/offerte/${offerta.id}`}
              className="font-medium text-[var(--accent)] underline"
            >
              {offerta.titolo}
            </Link>
          </p>
        ) : null}

        {coverLetter ? (
          <div className="mb-4 rounded-lg border border-[var(--line)] bg-slate-50/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Lettera di presentazione
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{coverLetter}</p>
          </div>
        ) : null}

        {showCv ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-slate-50/80 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--navy)]">CV disponibile</p>
              <p className="text-xs text-[var(--muted)]">
                {cvFileName
                  ? cvFileName
                  : "Il documento resta sul sistema aziendale del ricevitore."}
              </p>
            </div>
            <button
              type="button"
              disabled={cvLoading}
              onClick={() => void onVisualizzaCv()}
              className="h-9 shrink-0 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {cvLoading ? "Caricamento CV…" : "Visualizza CV"}
            </button>
          </div>
        ) : null}
        {cvError ? (
          <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {cvError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--navy)]">Stato</h2>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              candidatura.stato === "ASSUNTA"
                ? "bg-emerald-100 text-emerald-800"
                : candidatura.stato === "ARCHIVIATA"
                  ? "bg-stone-200 text-stone-800"
                  : candidatura.stato === "PROVA"
                    ? "bg-teal-100 text-teal-900"
                    : candidatura.stato === "COLLOQUIO"
                      ? "bg-sky-100 text-sky-800"
                      : candidatura.stato === "IN_VALUTAZIONE"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-700"
            }`}
          >
            {STATO_CANDIDATURA_LABELS[candidatura.stato]}
          </span>
        </div>
        <div className="mt-3">
          <PercorsoCandidatura stato={candidatura.stato} />
        </div>
        {bannerFase ? (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              bannerFase.tone === "danger"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : bannerFase.tone === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : bannerFase.tone === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-slate-200 bg-slate-50 text-slate-800"
            }`}
          >
            <span className="font-semibold">{bannerFase.titoloEsito}: </span>
            {bannerFase.valoreEsito}
            {" — "}
            {bannerFase.indicazione}
          </p>
        ) : null}
      </div>

      {showAzioni ? (
        <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-white p-4 text-sm">
          {suggerimento ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {suggerimento.messaggio}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {operabile &&
            !colloquioProgrammatoId &&
            canCreateColloquio &&
            !inColloquio ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setModal("colloquio");
                }}
                className={btnOutline}
              >
                Programma colloquio
                {colloquioObbligatorio ? " *" : ""}
              </button>
            ) : null}
            {operabile && provaObbligatoria ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const col = ultimoColloquio;
                  const mancaEsito = !col?.esito;
                  const mancaValutazione = !col?.valutazioneStelle;
                  const mancaParere = !String(col?.noteSvolgimento || "").trim();
                  if (mancaEsito || mancaValutazione || mancaParere) {
                    setError(
                      "Prima di programmare la prova registra esito, valutazione e parere sul colloquio (sezione Colloqui → Registra esito)."
                    );
                    if (col?.id) {
                      const el = document.getElementById(`colloquio-${col.id}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                    return;
                  }
                  setError(null);
                  setModal("prova");
                }}
                className={btnOutline}
              >
                Programma prova *
              </button>
            ) : null}
            {/* In Candidatura/Colloquio le note operative passano dai popup di programmazione. */}
            {!inPreColloquio && !inColloquio && operabile ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setModal("nota");
                }}
                className={btnOutline}
              >
                Aggiungi nota
              </button>
            ) : null}
            {primaria ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onClickStato(primaria)}
                className={classeBottoneStato(primaria, true)}
              >
                {pending ? "Salvataggio…" : etichettaAzioneStato(primaria)}
              </button>
            ) : null}
            {secondarie.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => onClickStato(s)}
                className={classeBottoneStato(s, false)}
              >
                {pending ? "Salvataggio…" : etichettaAzioneStato(s)}
              </button>
            ))}
            {canArchivia ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onClickStato("ARCHIVIATA")}
                className={classeBottoneStato("ARCHIVIATA", false)}
              >
                Archivia candidatura
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Eliminare definitivamente questa candidatura? L’operazione non si può annullare."
                    )
                  ) {
                    return;
                  }
                  const fd = new FormData();
                  fd.set("id", candidatura.id);
                  setError(null);
                  startTransition(async () => {
                    try {
                      await eliminaCandidaturaAction(fd);
                      router.push("/recruiting");
                      router.refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Eliminazione non riuscita"
                      );
                    }
                  });
                }}
                className="h-9 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-800 disabled:opacity-50"
              >
                Elimina candidatura
              </button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-rose-800">{error}</p> : null}
        </div>
      ) : null}

      <Modal
        open={modal === "nota"}
        title="Aggiungi nota"
        onClose={() => !pending && setModal(null)}
      >
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) => runAction(fd, aggiungiNotaCandidaturaAction, () => setModal(null))}
        >
          <input type="hidden" name="candidaturaId" value={candidatura.id} />
          <label>
            <span className={labelCls}>Data e ora</span>
            <input
              type="datetime-local"
              name="occurredAt"
              defaultValue={datetimeLocalValue()}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Sezione: {STATO_CANDIDATURA_LABELS[candidatura.stato]}</span>
            <textarea name="note" required maxLength={2000} rows={4} className={`${inputCls} h-auto py-2`} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setModal(null)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Salvataggio…" : "Aggiungi"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === "colloquio"}
        title="Programma colloquio"
        onClose={() => !pending && setModal(null)}
      >
        <form
          key={
            inPreColloquio
              ? modificaContatto
                ? contatto?.id ?? "edit-contatto"
                : "new-contatto"
              : "colloquio"
          }
          className="grid gap-3 p-4 text-sm"
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              try {
                const esitoRaw = String(fd.get("esito") || esitoContattoForm || "");
                if (inPreColloquio && !isEsitoContatto(esitoRaw)) {
                  setError("Seleziona l’esito del contatto");
                  return;
                }
                const esitoOk = isEsitoContatto(esitoRaw) ? esitoRaw : null;
                const scheduleColloquio = !inPreColloquio || esitoOk === "RAGGIUNTO";

                if (inPreColloquio && esitoOk) {
                  const contattoFd = new FormData();
                  contattoFd.set("candidaturaId", candidatura.id);
                  if (modificaContatto && contatto) {
                    contattoFd.set("id", contatto.id);
                  }
                  contattoFd.set("canale", String(fd.get("canale") || ""));
                  contattoFd.set("esito", esitoOk);
                  contattoFd.set("occurredAt", String(fd.get("occurredAt") || ""));
                  contattoFd.set("note", String(fd.get("noteContatto") || ""));
                  if (modificaContatto) {
                    await modificaContattoCandidaturaAction(contattoFd);
                  } else {
                    await registraContattoCandidaturaAction(contattoFd);
                  }
                }

                if (scheduleColloquio) {
                  const colloquioFd = new FormData();
                  colloquioFd.set("candidaturaId", candidatura.id);
                  colloquioFd.set("scheduledAt", String(fd.get("scheduledAt") || ""));
                  colloquioFd.set("modalita", String(fd.get("modalita") || ""));
                  colloquioFd.set(
                    "intervistatoreUserId",
                    String(fd.get("intervistatoreUserId") || "")
                  );
                  colloquioFd.set(
                    "notePreliminari",
                    String(fd.get("notePreliminari") || "")
                  );
                  await creaColloquioAction(colloquioFd);
                }

                setModal(null);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Operazione non riuscita");
              }
            });
          }}
        >
          <input type="hidden" name="candidaturaId" value={candidatura.id} />
          {inPreColloquio ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Contatto
              </p>
              <p className="text-xs text-[var(--muted)]">
                Il colloquio si può fissare solo se il candidato è stato raggiunto.
              </p>
              <label>
                <span className={labelCls}>Canale</span>
                <select
                  name="canale"
                  required
                  defaultValue={
                    modificaContatto && contatto ? contatto.canale : "TELEFONO"
                  }
                  className={inputCls}
                >
                  {CANALI_CONTATTO.map((c) => (
                    <option key={c} value={c}>
                      {CANALE_CONTATTO_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelCls}>Esito</span>
                <select
                  name="esito"
                  required
                  value={esitoContattoForm}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setEsitoContattoForm("");
                      return;
                    }
                    if (isEsitoContatto(v)) setEsitoContattoForm(v);
                  }}
                  className={inputCls}
                >
                  <option value="">Seleziona</option>
                  {ESITI_CONTATTO.map((e) => (
                    <option key={e} value={e}>
                      {ESITO_CONTATTO_LABELS[e]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelCls}>Data e ora contatto</span>
                <input
                  type="datetime-local"
                  name="occurredAt"
                  required
                  defaultValue={datetimeLocalValue(
                    modificaContatto && contatto ? contatto.occurredAt : undefined
                  )}
                  className={inputCls}
                />
              </label>
              <label>
                <span className={labelCls}>Sezione: {STATO_CANDIDATURA_LABELS[candidatura.stato]}</span>
                <textarea
                  name="noteContatto"
                  maxLength={2000}
                  rows={3}
                  defaultValue={modificaContatto && contatto ? contatto.note : ""}
                  className={`${inputCls} h-auto py-2`}
                />
              </label>
              <div className="border-t border-[var(--line)] pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Colloquio
                </p>
              </div>
            </>
          ) : null}
          {inPreColloquio && !esitoContattoSelezionato ? (
            <p className="text-xs font-medium text-amber-900">
              Seleziona l’esito del contatto. Il colloquio si abilita solo con «Raggiunto».
            </p>
          ) : inPreColloquio && !canProgrammareColloquio ? (
            <p className="text-xs font-medium text-amber-900">
              Con esito «{ESITO_CONTATTO_LABELS[esitoContattoForm]}» il colloquio non può
              essere fissato. Salva il contatto: l’esito resterà indicato sulla scheda.
            </p>
          ) : colloquioObbligatorio && canProgrammareColloquio ? (
            <p className="text-xs font-medium text-amber-900">
              Data e ora obbligatorie: programmare il colloquio fa passare la candidatura a
              Colloquio.
            </p>
          ) : null}
          <fieldset
            disabled={!canProgrammareColloquio}
            className={`grid gap-3 ${canProgrammareColloquio ? "" : "opacity-50"}`}
          >
            <label>
              <span className={labelCls}>Data e ora colloquio</span>
              <input
                type="datetime-local"
                name="scheduledAt"
                required={canProgrammareColloquio}
                defaultValue={datetimeLocalValue()}
                className={inputCls}
              />
            </label>
            <label>
              <span className={labelCls}>Modalità</span>
              <select name="modalita" defaultValue="PRESENZA" className={inputCls}>
                {MODALITA_COLLOQUIO.map((m) => (
                  <option key={m} value={m}>
                    {MODALITA_COLLOQUIO_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Intervistatore *</span>
              <select name="intervistatoreUserId" required defaultValue="" className={inputCls}>
                <option value="">Seleziona</option>
                {utenti.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Sezione: {STATO_CANDIDATURA_LABELS[candidatura.stato]}</span>
              <textarea
                name="notePreliminari"
                maxLength={2000}
                rows={3}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
          </fieldset>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setModal(null)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending || !canSalvareContattoColloquio}
              className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending
                ? "Salvataggio…"
                : canProgrammareColloquio
                  ? "Programma"
                  : "Salva contatto"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === "prova"}
        title="Programma prova"
        onClose={() => !pending && setModal(null)}
      >
        <form
          key={
            modificaContatto ? contatto?.id ?? "edit-contatto-prova" : "new-contatto-prova"
          }
          className="grid gap-3 p-4 text-sm"
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              try {
                const esitoRaw = String(fd.get("esito") || esitoContattoForm || "");
                if (!isEsitoContatto(esitoRaw)) {
                  setError("Seleziona l’esito del contatto");
                  return;
                }
                const esitoOk = esitoRaw;
                const scheduleProva = esitoOk === "RAGGIUNTO";

                const contattoFd = new FormData();
                contattoFd.set("candidaturaId", candidatura.id);
                if (modificaContatto && contatto) {
                  contattoFd.set("id", contatto.id);
                }
                contattoFd.set("canale", String(fd.get("canale") || ""));
                contattoFd.set("esito", esitoOk);
                contattoFd.set("occurredAt", String(fd.get("occurredAt") || ""));
                contattoFd.set("note", String(fd.get("noteContatto") || ""));
                if (modificaContatto) {
                  await modificaContattoCandidaturaAction(contattoFd);
                } else {
                  await registraContattoCandidaturaAction(contattoFd);
                }

                if (scheduleProva) {
                  const provaFd = new FormData();
                  provaFd.set("candidaturaId", candidatura.id);
                  provaFd.set("scheduledAt", String(fd.get("scheduledAt") || ""));
                  provaFd.set("modalita", String(fd.get("modalita") || ""));
                  provaFd.set(
                    "affiancatoreUserId",
                    String(fd.get("affiancatoreUserId") || "")
                  );
                  provaFd.set(
                    "notePreliminari",
                    String(fd.get("notePreliminari") || "")
                  );
                  await creaProvaAction(provaFd);
                }

                setModal(null);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Operazione non riuscita");
              }
            });
          }}
        >
          <input type="hidden" name="candidaturaId" value={candidatura.id} />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Contatto
          </p>
          <p className="text-xs text-[var(--muted)]">
            La prova si può fissare solo se il candidato è stato raggiunto.
          </p>
          <label>
            <span className={labelCls}>Canale</span>
            <select
              name="canale"
              required
              defaultValue={
                modificaContatto && contatto ? contatto.canale : "TELEFONO"
              }
              className={inputCls}
            >
              {CANALI_CONTATTO.map((c) => (
                <option key={c} value={c}>
                  {CANALE_CONTATTO_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Esito</span>
            <select
              name="esito"
              required
              value={esitoContattoForm}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setEsitoContattoForm("");
                  return;
                }
                if (isEsitoContatto(v)) setEsitoContattoForm(v);
              }}
              className={inputCls}
            >
              <option value="">Seleziona</option>
              {ESITI_CONTATTO.map((e) => (
                <option key={e} value={e}>
                  {ESITO_CONTATTO_LABELS[e]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Data e ora contatto</span>
            <input
              type="datetime-local"
              name="occurredAt"
              required
              defaultValue={datetimeLocalValue(
                modificaContatto && contatto ? contatto.occurredAt : undefined
              )}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Sezione: {STATO_CANDIDATURA_LABELS[candidatura.stato]}</span>
            <textarea
              name="noteContatto"
              maxLength={2000}
              rows={3}
              defaultValue={modificaContatto && contatto ? contatto.note : ""}
              className={`${inputCls} h-auto py-2`}
            />
          </label>
          <div className="border-t border-[var(--line)] pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Prova
            </p>
          </div>
          {!esitoContattoSelezionato ? (
            <p className="text-xs font-medium text-amber-900">
              Seleziona l’esito del contatto. La prova si abilita solo con «Raggiunto».
            </p>
          ) : !canProgrammareProva ? (
            <p className="text-xs font-medium text-amber-900">
              Con esito «{ESITO_CONTATTO_LABELS[esitoContattoForm]}» la prova non può
              essere fissata. Salva il contatto: l’esito resterà indicato sulla scheda.
            </p>
          ) : (
            <p className="text-xs font-medium text-amber-900">
              Data e ora obbligatorie: programmare la prova fa passare la candidatura a
              Prova.
            </p>
          )}
          <fieldset
            disabled={!canProgrammareProva}
            className={`grid gap-3 ${canProgrammareProva ? "" : "opacity-50"}`}
          >
            <label>
              <span className={labelCls}>Data e ora prova</span>
              <input
                type="datetime-local"
                name="scheduledAt"
                required={canProgrammareProva}
                defaultValue={datetimeLocalValue()}
                className={inputCls}
              />
            </label>
            <label>
              <span className={labelCls}>Modalità</span>
              <select name="modalita" defaultValue="PRESENZA" className={inputCls}>
                {MODALITA_COLLOQUIO.map((m) => (
                  <option key={m} value={m}>
                    {MODALITA_COLLOQUIO_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Affiancatore</span>
              <select name="affiancatoreUserId" defaultValue="" className={inputCls}>
                <option value="">—</option>
                {supervisori.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Sezione: {STATO_CANDIDATURA_LABELS[candidatura.stato]}</span>
              <textarea
                name="notePreliminari"
                maxLength={2000}
                rows={3}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
          </fieldset>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setModal(null)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending || !canSalvareContattoProva}
              className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending
                ? "Salvataggio…"
                : canProgrammareProva
                  ? "Programma"
                  : "Salva contatto"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmTo}
        title={confirmTo === "ASSUNTA" ? "Conferma assunzione" : "Conferma archiviazione"}
        onClose={() => !pending && setConfirmTo(null)}
      >
        {confirmTo ? (
          <div className="grid gap-3 p-4 text-sm">
            <p className="font-medium">
              {confirmTo === "ASSUNTA"
                ? "Azione definitiva: la candidatura passerà ad Assunto/a."
                : "Azione definitiva: la candidatura verrà archiviata."}
            </p>
            <p>{messaggioConfermaStatoTerminale(confirmTo, hasColloquiAperti)}</p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmTo(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => submitStato(confirmTo)}
                className={
                  confirmTo === "ASSUNTA"
                    ? "h-9 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
                    : "h-9 rounded-lg bg-rose-800 px-3 text-sm font-semibold text-white disabled:opacity-50"
                }
              >
                {pending
                  ? "Salvataggio…"
                  : confirmTo === "ASSUNTA"
                    ? "Conferma assunzione"
                    : "Conferma archiviazione"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
