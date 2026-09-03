"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  CalendarDays,
  Archive,
  Banknote,
  FileText,
  FolderOpen,
  MessageSquare,
  Receipt,
  Search,
  UserRound,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { InviaMessaggioCollega } from "@/components/pratica/InviaMessaggioCollega";
import { CercaPraticaPopup } from "@/components/pratica/CercaPraticaPopup";
import { AgendaMemoPopup } from "@/components/pratica/AgendaMemoPopup";
import { CalcolatricePopup } from "@/components/pratica/CalcolatricePopup";
import { IncassoPopup } from "@/components/pratica/IncassoPopup";
import { PianoRientroPopup } from "@/components/pratica/PianoRientroPopup";
import { SaldoStralcioPopup } from "@/components/pratica/SaldoStralcioPopup";
import { InserisciNotaServizio } from "@/components/pratica/RegistroNote";
import {
  buildPraticaCollegataElencoHref,
  isPraticaChiusa,
  type FiltroCollegata,
} from "@/lib/praticaCollegata";
import {
  fetchPraticheStessoDebitore,
  normalizePayloadForPratica,
  peekPraticheStessoDebitore,
  seedPraticheStessoDebitore,
  type PraticheStessoDebitoreClientPayload,
} from "@/lib/praticheStessoDebitoreClient";
import { useEscBack } from "@/lib/useEscBack";
import { canShowIncassoPopup } from "@/lib/permissions";
import { NOTA_BOZZA_EVENT, type NotaBozzaDetail } from "@/lib/notaBozza";
import { RegistrazioneTelefonataControl } from "@/components/pratica/RegistrazioneTelefonataControl";
import type { RecordingMode } from "@/lib/recordingMode";
import type {
  CodiceScaricoPerimetro,
  PdrConfigPerimetro,
  StralcioConfigPerimetro,
} from "@/lib/mandantePerimetri";
import { emptyPdrConfig, emptyStralcioConfig } from "@/lib/mandantePerimetri";

type Voce = {
  id: string;
  numero: string;
  nome: string;
  stato: string;
  mandanteNome: string;
};

type PopupKey =
  | "cerca"
  | "agenda"
  | "nota"
  | "messaggi"
  | "piano"
  | "stralcio"
  | "calcolatrice"
  | "incasso"
  | "pdrAssente";

const BTN_BASE =
  "inline-flex h-7 w-14 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap px-0.5 text-center text-[10px] font-semibold leading-none";

const BTN = `${BTN_BASE} cursor-pointer rounded border border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] text-[#132033] hover:from-[#fafafa] disabled:cursor-not-allowed disabled:opacity-45`;

const BTN_INT_LAV = `${BTN_BASE} cursor-pointer rounded border border-[#2d6a4f] bg-gradient-to-b from-[#b7e4c7] to-[#74c69d] text-[#1b4332] hover:from-[#d8f3dc]`;

const BTN_INT_CHIUSE = `${BTN_BASE} cursor-pointer rounded border border-[#c2410c] bg-gradient-to-b from-[#fed7aa] to-[#fb923c] text-[#7c2d12] hover:from-[#ffedd5]`;

const BTN_ESC = `${BTN_BASE} cursor-pointer rounded border border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#eef4f8]`;

/** Tasti strumenti (non Fn): testo, stile flat blu, più larghi */
const BTN_TOOL =
  "inline-flex h-7 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded border border-[#1a4f7a] bg-[#e8f1f8] px-2.5 text-[10px] font-bold tracking-wide text-[#123a5c] hover:bg-[#d4e6f4] disabled:cursor-not-allowed disabled:opacity-45";

const TOOL_SEP = "mx-3 h-6 w-px shrink-0 self-center bg-[#a8b4c0]";

const ICON = "h-3.5 w-3.5 shrink-0";

const CONTABILE = [
  { key: "fatture", label: "Fatture insolute", f: "F6", icon: Receipt },
  { key: "estratto", label: "Estratto conto", f: "F7", icon: FileText },
  { key: "incassi", label: "Incassi registrati", f: "F8", icon: Banknote },
] as const;

function FunzioneLabel({ f, icon }: { f: string; icon: ReactNode }) {
  return (
    <>
      <span>{f}</span>
      {icon}
    </>
  );
}

function Hint({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      className="inline-flex"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-[#132033] px-2 py-0.5 text-[11px] font-medium text-white shadow-md"
              style={{ left: pos.x, top: pos.y - 6 }}
            >
              {label}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

export function PraticaFunzioniBar({
  praticaId,
  attivo,
  canEditNotes,
  praticaLocked = false,
  codiceScarico,
  codiciScaricoOperatore = [],
  memoAt,
  promessaAt,
  promessaImporto,
  promessaMetodo,
  residuo = 0,
  pdrDisponibile = false,
  pdrConfig,
  stralcioConfig,
  nextPraticaHref,
  showRecordingControl,
  recordingMode = "manual",
  initialCollegate = null,
  suppressF9Flash = false,
  currentUserRole,
}: {
  praticaId: string;
  attivo?: "fatture" | "estratto" | "incassi";
  canEditNotes?: boolean;
  praticaLocked?: boolean;
  codiceScarico?: string | null;
  codiciScaricoOperatore?: CodiceScaricoPerimetro[];
  memoAt?: string | null;
  promessaAt?: string | null;
  promessaImporto?: number | null;
  promessaMetodo?: string | null;
  residuo?: number;
  /** Se false, piano di rientro comunica che non è previsto sul perimetro. */
  pdrDisponibile?: boolean;
  pdrConfig?: PdrConfigPerimetro;
  /** Condizioni stralcio mandante (opzionale). */
  stralcioConfig?: StralcioConfigPerimetro;
  nextPraticaHref?: string | null;
  showRecordingControl?: boolean;
  recordingMode?: RecordingMode;
  /** Payload collegate già noto (SSR / navigazione elenco). */
  initialCollegate?: PraticheStessoDebitoreClientPayload | null;
  /** Niente lampeggio F9 (click tra pratiche collegate). */
  suppressF9Flash?: boolean;
  currentUserRole?: string;
}) {
  const router = useRouter();
  const [popup, setPopup] = useState<PopupKey | null>(null);
  const [notaBozza, setNotaBozza] = useState<{ testo: string; key: number } | null>(
    null
  );
  const [corrente, setCorrente] = useState<Voce | null>(null);
  const [altre, setAltre] = useState<Voce[]>([]);
  const [altreChiuse, setAltreChiuse] = useState<Voce[]>([]);
  const [flashF9, setFlashF9] = useState(false);

  useEffect(() => {
    router.prefetch(`/pratiche/${praticaId}/fatture`);
    router.prefetch(`/pratiche/${praticaId}/estratto`);
    router.prefetch(`/pratiche/${praticaId}/incassi`);
    router.prefetch(`/pratiche/${praticaId}/stampa`);
  }, [praticaId, router]);

  useEffect(() => {
    let cancelled = false;

    function applyPayload(data: PraticheStessoDebitoreClientPayload) {
      const normalized = normalizePayloadForPratica(data, praticaId);
      setCorrente(normalized.corrente);
      setAltre(normalized.altre);
      setAltreChiuse(normalized.altreChiuse);
      if (!suppressF9Flash && normalized.altre.length > 0) {
        requestAnimationFrame(() => {
          if (!cancelled) setFlashF9(true);
        });
      }
    }

    if (suppressF9Flash) {
      setFlashF9(false);
      const fromSsr = initialCollegate
        ? normalizePayloadForPratica(initialCollegate, praticaId)
        : null;
      const fromCache = peekPraticheStessoDebitore(praticaId);
      const data = fromSsr ?? fromCache;
      if (data) {
        seedPraticheStessoDebitore(data);
        applyPayload(data);
        return () => {
          cancelled = true;
        };
      }
    }

    setFlashF9(false);

    if (initialCollegate) {
      seedPraticheStessoDebitore(initialCollegate);
      applyPayload(initialCollegate);
      return () => {
        cancelled = true;
      };
    }

    const cached = peekPraticheStessoDebitore(praticaId);
    if (cached) {
      applyPayload(cached);
      return () => {
        cancelled = true;
      };
    }

    if (!suppressF9Flash) {
      setCorrente(null);
      setAltre([]);
      setAltreChiuse([]);
    }

    const timer = window.setTimeout(() => {
      fetchPraticheStessoDebitore(praticaId).then((data) => {
        if (cancelled || !data) return;
        applyPayload(data);
      });
    }, suppressF9Flash ? 0 : 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [praticaId, initialCollegate, suppressF9Flash]);

  const haCollegateInLavorazione = altre.length > 0;
  const haIntestateChiuse =
    (corrente && isPraticaChiusa(corrente.stato)) || altreChiuse.length > 0;
  const azioniBloccate = praticaLocked || !canEditNotes;
  const showIncassoPopup = canShowIncassoPopup(currentUserRole);

  useEscBack(`/pratiche/${praticaId}`, Boolean(attivo) && !popup);

  useEffect(() => {
    function onBozza(e: Event) {
      if (azioniBloccate) return;
      const ce = e as CustomEvent<NotaBozzaDetail>;
      const testo = ce.detail?.testo?.trim();
      if (!testo) return;
      setNotaBozza({ testo: `${testo} `, key: Date.now() });
      setPopup("nota");
    }
    window.addEventListener(NOTA_BOZZA_EVENT, onBozza);
    return () => window.removeEventListener(NOTA_BOZZA_EVENT, onBozza);
  }, [azioniBloccate]);

  function apriElencoCollegate(filtro: FiltroCollegata) {
    router.push(buildPraticaCollegataElencoHref(praticaId, filtro));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (popup) return;

      const popups: Record<string, PopupKey> = {
        F1: "cerca",
        ...(azioniBloccate
          ? {}
          : {
              F2: "agenda",
              F12: "messaggi",
            }),
      };
      if (e.key === "F3") {
        e.preventDefault();
        if (nextPraticaHref) router.push(nextPraticaHref);
        return;
      }
      if (e.key === "F5" && !azioniBloccate) {
        e.preventDefault();
        setNotaBozza(null);
        setPopup("nota");
        return;
      }
      const pop = popups[e.key];
      if (pop) {
        e.preventDefault();
        setPopup(pop);
        return;
      }

      if (e.key === "F9") {
        e.preventDefault();
        if (haCollegateInLavorazione) {
          apriElencoCollegate("aperta");
        }
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        if (haIntestateChiuse) {
          apriElencoCollegate("chiusa");
        }
        return;
      }

      if (e.key === "F6") {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}/fatture`);
      }
      if (e.key === "F7") {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}/estratto`);
      }
      if (e.key === "F8") {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}/incassi`);
      }
      if (e.key === "F11") {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}/stampa`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [praticaId, router, popup, azioniBloccate, haCollegateInLavorazione, haIntestateChiuse, nextPraticaHref]);

  return (
    <>
      <div
        className={`flex flex-wrap items-center gap-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 ${
          flashF9
            ? "f9-bar-flashing overflow-visible"
            : "overflow-x-auto"
        }`}
      >
        <Hint label="Cerca">
          <button
            type="button"
            className={BTN}
            onClick={() => setPopup("cerca")}
          >
            <FunzioneLabel f="F1" icon={<Search className={ICON} />} />
          </button>
        </Hint>
        <Hint label="Agenda">
          <button
            type="button"
            className={BTN}
            onClick={() => setPopup("agenda")}
            disabled={azioniBloccate}
          >
            <FunzioneLabel f="F2" icon={<CalendarDays className={ICON} />} />
          </button>
        </Hint>
        <Hint label="Messaggi">
          <button
            type="button"
            className={BTN}
            onClick={() => setPopup("messaggi")}
            disabled={azioniBloccate}
          >
            <FunzioneLabel f="F12" icon={<MessageSquare className={ICON} />} />
          </button>
        </Hint>
        <Hint label="Nota registro / esito">
          <button
            type="button"
            className={BTN}
            onClick={() => {
              setNotaBozza(null);
              setPopup("nota");
            }}
            disabled={azioniBloccate}
          >
            <FunzioneLabel
              f="F5"
              icon={
                <span className="text-[11px] font-black leading-none tracking-tight">
                  NT
                </span>
              }
            />
          </button>
        </Hint>
        {CONTABILE.map((t) => {
          const href = `/pratiche/${praticaId}/${t.key}`;
          const on = attivo === t.key;
          const Icon = t.icon;
          return (
            <Hint key={t.key} label={t.label}>
              <Link
                href={href}
                className={`${BTN} ${on ? "border-[#132033] bg-[#132033] text-white hover:from-[#132033]" : ""}`}
              >
                <FunzioneLabel f={t.f} icon={<Icon className={ICON} />} />
              </Link>
            </Hint>
          );
        })}
        <Hint label="Collegate in lavorazione">
          <span className={flashF9 ? "f9-collegate-flash-wrap" : "inline-flex"}>
            <button
              type="button"
              className={
                flashF9
                  ? `${BTN_BASE} f9-collegate-flash cursor-pointer`
                  : haCollegateInLavorazione
                    ? BTN_INT_LAV
                    : BTN
              }
              onClick={() => apriElencoCollegate("aperta")}
              disabled={!haCollegateInLavorazione}
              onAnimationEnd={() => setFlashF9(false)}
            >
              <FunzioneLabel f="F9" icon={<FolderOpen className={ICON} />} />
            </button>
          </span>
        </Hint>
        <Hint label="Collegate generiche">
          <button
            type="button"
            className={haIntestateChiuse ? BTN_INT_CHIUSE : BTN}
            onClick={() => apriElencoCollegate("chiusa")}
            disabled={!haIntestateChiuse}
          >
            <FunzioneLabel f="F10" icon={<Archive className={ICON} />} />
          </button>
        </Hint>
        <Hint label="Stampa pratica">
          <Link href={`/pratiche/${praticaId}/stampa`} className={BTN}>
            <FunzioneLabel f="F11" icon={<Printer className={ICON} />} />
          </Link>
        </Hint>

        <span className={TOOL_SEP} aria-hidden />
        <span
          className="inline-flex flex-wrap items-center gap-1"
          aria-label="Strumenti pratica"
        >
          <Hint label="Piano di rientro">
            <button
              type="button"
              className={BTN_TOOL}
              onClick={() => setPopup(pdrDisponibile ? "piano" : "pdrAssente")}
              disabled={azioniBloccate}
            >
              Piano di rientro
            </button>
          </Hint>
          <Hint label="Saldo a stralcio">
            <button
              type="button"
              className={BTN_TOOL}
              onClick={() => setPopup("stralcio")}
            >
              Saldo a stralcio
            </button>
          </Hint>
          <Hint label="Calcolatrice">
            <button
              type="button"
              className={BTN_TOOL}
              onClick={() => setPopup("calcolatrice")}
            >
              Calcolatrice
            </button>
          </Hint>
        </span>
        {showIncassoPopup ? (
          <>
            <span className={TOOL_SEP} aria-hidden />
            <Hint label="Registra incasso">
              <button
                type="button"
                className={BTN_TOOL}
                onClick={() => setPopup("incasso")}
              >
                Inserisci incasso
              </button>
            </Hint>
          </>
        ) : null}

        {showRecordingControl ? (
          <RegistrazioneTelefonataControl praticaId={praticaId} mode={recordingMode} />
        ) : null}
        {attivo ? (
          <Hint label="Anagrafica">
            <Link href={`/pratiche/${praticaId}`} className={BTN_ESC}>
              <FunzioneLabel f="Esc" icon={<UserRound className={ICON} />} />
            </Link>
          </Hint>
        ) : null}
      </div>

      <Modal
        open={popup === "cerca"}
        title="F1 · Ricerca pratica"
        onClose={() => setPopup(null)}
        wide
      >
        <CercaPraticaPopup praticaId={praticaId} onDone={() => setPopup(null)} />
      </Modal>

      <Modal
        open={popup === "agenda"}
        title="F2 · Agenda"
        onClose={() => setPopup(null)}
        wide
      >
        <AgendaMemoPopup
          praticaId={praticaId}
          memoAt={memoAt}
          onDone={() => setPopup(null)}
        />
      </Modal>

      <Modal
        open={popup === "nota"}
        title="F5 · Nota registro / esito"
        onClose={() => {
          setPopup(null);
          setNotaBozza(null);
        }}
        wide
      >
        {canEditNotes ? (
          <InserisciNotaServizio
            praticaId={praticaId}
            codiceScarico={codiceScarico}
            codiciScaricoOperatore={codiciScaricoOperatore}
            promessaAt={promessaAt}
            promessaImporto={promessaImporto}
            promessaMetodo={promessaMetodo}
            bozzaNota={notaBozza?.testo}
            bozzaKey={notaBozza?.key}
            inModal
            onDone={() => {
              setPopup(null);
              setNotaBozza(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={popup === "messaggi"}
        title="F12 · Messaggi"
        onClose={() => setPopup(null)}
        wide
      >
        <InviaMessaggioCollega praticaId={praticaId} inModal />
      </Modal>

      <Modal
        open={popup === "piano"}
        title="Piano di rientro"
        onClose={() => setPopup(null)}
      >
        <PianoRientroPopup
          praticaId={praticaId}
          residuo={residuo}
          onDone={() => setPopup(null)}
        />
      </Modal>

      <Modal
        open={popup === "stralcio"}
        title="Saldo a stralcio"
        onClose={() => setPopup(null)}
        wide
      >
        <SaldoStralcioPopup
          praticaId={praticaId}
          residuo={residuo}
          stralcio={stralcioConfig ?? emptyStralcioConfig()}
          pdr={pdrConfig ?? emptyPdrConfig()}
          onDone={() => setPopup(null)}
        />
      </Modal>

      <Modal
        open={popup === "pdrAssente"}
        title="Piano non disponibile"
        onClose={() => setPopup(null)}
      >
        <div className="space-y-3 px-3 py-3 text-sm">
          <p className="text-[var(--muted)]">
            Non sono previste possibilità di crearne uno: sul perimetro di questa
            mandante non risultano fasce PDR configurate per il piano di rientro.
          </p>
          <button
            type="button"
            onClick={() => setPopup(null)}
            className="h-8 rounded border border-[var(--line)] px-3 text-xs hover:bg-[#eef4f8]"
          >
            Chiudi
          </button>
        </div>
      </Modal>

      <Modal
        open={popup === "calcolatrice"}
        title="calcolatrice"
        onClose={() => setPopup(null)}
      >
        <CalcolatricePopup />
      </Modal>

      <Modal
        open={popup === "incasso"}
        title="Inserisci incasso"
        onClose={() => setPopup(null)}
      >
        <IncassoPopup praticaId={praticaId} onDone={() => setPopup(null)} />
      </Modal>
    </>
  );
}
