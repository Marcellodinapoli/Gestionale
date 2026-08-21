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
  Smartphone,
  UserRound,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { InviaMessaggioCollega } from "@/components/pratica/InviaMessaggioCollega";
import { CercaPraticaPopup } from "@/components/pratica/CercaPraticaPopup";
import { AgendaMemoPopup } from "@/components/pratica/AgendaMemoPopup";
import { InserisciNotaServizio } from "@/components/pratica/RegistroNote";
import {
  buildPraticaCollegataElencoHref,
  isPraticaChiusa,
  type FiltroCollegata,
} from "@/lib/praticaCollegata";
import { useEscBack } from "@/lib/useEscBack";
import { NOTA_BOZZA_EVENT, type NotaBozzaDetail } from "@/lib/notaBozza";
import { RegistrazioneTelefonataControl } from "@/components/pratica/RegistrazioneTelefonataControl";
import type { RecordingMode } from "@/lib/recordingConfig";

type Voce = {
  id: string;
  numero: string;
  nome: string;
  stato: string;
  mandanteNome: string;
};

type PopupKey = "cerca" | "agenda" | "nota" | "messaggi" | "sms";

const BTN_BASE =
  "inline-flex h-7 w-14 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap px-0.5 text-center text-[10px] font-semibold leading-none";

const BTN = `${BTN_BASE} rounded border border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] text-[#132033] hover:from-[#fafafa] disabled:cursor-not-allowed disabled:opacity-45`;

const BTN_INT_LAV = `${BTN_BASE} rounded border border-[#2d6a4f] bg-gradient-to-b from-[#b7e4c7] to-[#74c69d] text-[#1b4332] hover:from-[#d8f3dc]`;

const BTN_INT_CHIUSE = `${BTN_BASE} rounded border border-[#c2410c] bg-gradient-to-b from-[#fed7aa] to-[#fb923c] text-[#7c2d12] hover:from-[#ffedd5]`;

const BTN_ESC = `${BTN_BASE} rounded border border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#eef4f8]`;

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
  esitoContatto,
  tipoContatto,
  memoAt,
  promessaAt,
  promessaImporto,
  nextPraticaHref,
  showRecordingControl,
  recordingMode = "manual",
}: {
  praticaId: string;
  attivo?: "fatture" | "estratto" | "incassi";
  canEditNotes?: boolean;
  praticaLocked?: boolean;
  esitoContatto?: string | null;
  tipoContatto?: string | null;
  memoAt?: string | null;
  promessaAt?: string | null;
  promessaImporto?: number | null;
  nextPraticaHref?: string | null;
  showRecordingControl?: boolean;
  recordingMode?: RecordingMode;
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
    let cancelled = false;
    setFlashF9(false);
    setCorrente(null);
    setAltre([]);
    setAltreChiuse([]);
    fetch(`/api/pratiche-stesso-debitore?id=${encodeURIComponent(praticaId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            corrente: Voce;
            altre: Voce[];
            altreChiuse: Voce[];
          } | null
        ) => {
        if (cancelled || !data) return;
        setCorrente(data.corrente);
        setAltre(data.altre);
        setAltreChiuse(data.altreChiuse);
        if (data.altre.length > 0) {
          requestAnimationFrame(() => {
            if (!cancelled) setFlashF9(true);
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCorrente(null);
          setAltre([]);
          setAltreChiuse([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [praticaId]);

  const haCollegateInLavorazione = altre.length > 0;
  const haIntestateChiuse =
    (corrente && isPraticaChiusa(corrente.stato)) || altreChiuse.length > 0;
  const azioniBloccate = praticaLocked || !canEditNotes;

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
              F4: "sms",
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
        className={`flex flex-wrap gap-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 ${
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
        <Hint label="SMS">
          <button
            type="button"
            className={BTN}
            onClick={() => setPopup("sms")}
            disabled={azioniBloccate}
          >
            <FunzioneLabel f="F4" icon={<Smartphone className={ICON} />} />
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
                  ? `${BTN_BASE} f9-collegate-flash`
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
            esitoContatto={esitoContatto}
            tipoContatto={tipoContatto}
            memoAt={memoAt}
            promessaAt={promessaAt}
            promessaImporto={promessaImporto}
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
        open={popup === "sms"}
        title="F4 · SMS"
        onClose={() => setPopup(null)}
      >
        <div className="p-4 text-sm text-[var(--muted)]">
          Invio SMS al debitore — funzione in preparazione.
        </div>
      </Modal>

    </>
  );
}
