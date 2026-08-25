"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckSquare, Mic, PhoneOff, Square } from "lucide-react";
import { confermaRegistrazioneTelefonataAction } from "@/actions/registrazioni";
import {
  CALL_SESSION_END,
  CALL_SESSION_START,
  terminaSessioneChiamata,
  type CallSessionDetail,
} from "@/lib/callSession";
import type { RecordingMode } from "@/lib/recordingMode";

const BTN_BASE =
  "inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded border px-2 text-[10px] font-semibold leading-none";

export function RegistrazioneTelefonataControl({
  praticaId,
  mode,
}: {
  praticaId: string;
  mode: RecordingMode;
}) {
  const [sessione, setSessione] = useState<CallSessionDetail | null>(null);
  const [evidenzaBackOffice, setEvidenzaBackOffice] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onStart(e: Event) {
      const detail = (e as CustomEvent<CallSessionDetail>).detail;
      if (!detail?.numero) return;
      setSessione({ numero: detail.numero });
      setEvidenzaBackOffice(false);
      setMsg(null);
    }
    function onEnd() {
      setSessione(null);
      setEvidenzaBackOffice(false);
      setMsg(null);
    }
    window.addEventListener(CALL_SESSION_START, onStart);
    window.addEventListener(CALL_SESSION_END, onEnd);
    return () => {
      window.removeEventListener(CALL_SESSION_START, onStart);
      window.removeEventListener(CALL_SESSION_END, onEnd);
    };
  }, []);

  function chiudiSessione() {
    setSessione(null);
    setEvidenzaBackOffice(false);
    terminaSessioneChiamata();
  }

  function salvaRegistrazione() {
    if (!sessione) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("praticaId", praticaId);
        fd.set("numero", sessione.numero);
        fd.set("mode", mode);
        if (evidenzaBackOffice) fd.set("evidenzaBackOffice", "1");
        await confermaRegistrazioneTelefonataAction(fd);
        setMsg("Registrazione confermata");
        setTimeout(() => chiudiSessione(), 1200);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  function terminaSenzaRegistrazione() {
    chiudiSessione();
  }

  if (!sessione) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-1">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Chiamata {sessione.numero}
      </span>

      <label
        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 text-[10px] text-[var(--navy)]"
        title="Segnala al back office qualcosa di importante in questa telefonata"
      >
        <input
          type="checkbox"
          checked={evidenzaBackOffice}
          onChange={(e) => setEvidenzaBackOffice(e.target.checked)}
          className="hidden"
        />
        {evidenzaBackOffice ? (
          <CheckSquare className="h-3.5 w-3.5 text-amber-600" />
        ) : (
          <Square className="h-3.5 w-3.5 text-[var(--muted)]" />
        )}
        BK OFF
      </label>

      {mode === "manual" ? (
        <>
          <button
            type="button"
            onClick={salvaRegistrazione}
            disabled={pending}
            className={`${BTN_BASE} border-[#1d4ed8] bg-gradient-to-b from-[#bfdbfe] to-[#60a5fa] text-[#1e3a8a] hover:from-[#dbeafe] disabled:opacity-50`}
            title="Conferma la registrazione di questa telefonata"
          >
            <Mic className="h-3.5 w-3.5" />
            {pending ? "Salvo..." : "Conferma REC"}
          </button>
          <button
            type="button"
            onClick={terminaSenzaRegistrazione}
            disabled={pending}
            className={`${BTN_BASE} border-[var(--line)] bg-white text-[var(--muted)] hover:bg-slate-100 disabled:opacity-50`}
            title="Termina la chiamata senza registrare"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Termina
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={salvaRegistrazione}
          disabled={pending}
          className={`${BTN_BASE} border-[#9a3412] bg-gradient-to-b from-[#fdba74] to-[#fb923c] text-[#7c2d12] hover:from-[#fed7aa] disabled:opacity-50`}
          title="Termina la chiamata e salva la registrazione"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          {pending ? "Salvo..." : "Termina e registra"}
        </button>
      )}

      {msg ? (
        <span
          className={`text-[10px] font-semibold ${
            msg === "Registrazione confermata" ? "text-emerald-600" : "text-[var(--danger)]"
          }`}
        >
          {msg}
        </span>
      ) : null}
    </div>
  );
}
