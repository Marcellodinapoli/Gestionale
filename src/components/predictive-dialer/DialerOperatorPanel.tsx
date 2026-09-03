"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import {
  DIALER_CAMPAGNA_LABELS,
  DIALER_SESSIONE_LABELS,
} from "@/lib/predictive-dialer/constants";
import {
  acceptDialerCampagnaAction,
  exitDialerAction,
  finishPostCallAction,
  pauseDialerAction,
  resumeDialerAction,
} from "@/actions/predictiveDialer";
import type {
  DialerInvitoCampagnaDto,
  DialerOperatoreSessioneDto,
} from "@/lib/predictive-dialer/types";

type StreamPayload = {
  inviti: DialerInvitoCampagnaDto[];
  sessione: DialerOperatoreSessioneDto | null;
};

function statoBadge(stato: string) {
  const colors: Record<string, string> = {
    disponibile: "bg-emerald-100 text-emerald-900",
    connecting: "bg-sky-100 text-sky-900",
    in_chiamata: "bg-blue-100 text-blue-900",
    post_call: "bg-amber-100 text-amber-900",
    pausa: "bg-orange-100 text-orange-900",
    fuori: "bg-gray-100 text-gray-700",
    offline: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold ${colors[stato] ?? "bg-gray-100"}`}
    >
      {DIALER_SESSIONE_LABELS[stato as keyof typeof DIALER_SESSIONE_LABELS] ?? stato}
    </span>
  );
}

function PostCallTimer({
  fineAt,
  onFinish,
}: {
  fineAt: string;
  onFinish: () => void;
}) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(fineAt).getTime() - Date.now()) / 1000));
      setSec(left);
      if (left <= 0) onFinish();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [fineAt, onFinish]);
  return <span className="font-mono text-lg font-bold text-[var(--navy)]">{sec}s</span>;
}

export function DialerOperatorPanel() {
  const router = useRouter();
  const [data, setData] = useState<StreamPayload>({ inviti: [], sessione: null });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [praticaAperturaBloccata, setPraticaAperturaBloccata] = useState<string | null>(null);
  const openedPraticaRef = useRef<string | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/predictive-dialer/stream");
      es.addEventListener("dialer", (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as StreamPayload;
          setData({ inviti: parsed.inviti ?? [], sessione: parsed.sessione ?? null });
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* fallback: no stream */
    }
    return () => es?.close();
  }, []);

  const sessione = data.sessione;
  const invitiPending = data.inviti.filter((i) => !i.accettatoAt);

  const openPratica = useCallback((praticaId: string): boolean => {
    const popup = window.open(`/pratiche/${praticaId}`, "_blank", "noopener,noreferrer");
    if (!popup) {
      setPraticaAperturaBloccata(praticaId);
      return false;
    }
    openedPraticaRef.current = praticaId;
    setPraticaAperturaBloccata(null);
    return true;
  }, []);

  useEffect(() => {
    if (sessione?.sessioneStato === "in_chiamata" && sessione.praticaCorrenteId) {
      if (openedPraticaRef.current === sessione.praticaCorrenteId) return;
      openPratica(sessione.praticaCorrenteId);
    }
    if (sessione?.sessioneStato !== "in_chiamata") {
      setPraticaAperturaBloccata(null);
    }
  }, [sessione?.sessioneStato, sessione?.praticaCorrenteId, openPratica]);

  async function run(action: () => Promise<void>, key: string) {
    setPending(key);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {sessione ? (
        <Card title="Sessione dialer attiva">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--navy)]">{sessione.campagnaNome}</span>
            {statoBadge(sessione.sessioneStato)}
          </div>

          {sessione.sessioneStato === "in_chiamata" && praticaAperturaBloccata ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                Il browser ha bloccato l&apos;apertura automatica della pratica.
              </p>
              <Link
                href={`/pratiche/${praticaAperturaBloccata}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded border-2 border-[var(--navy)] bg-[var(--navy)] px-4 py-2 text-sm font-bold text-white"
                onClick={() => {
                  openedPraticaRef.current = praticaAperturaBloccata;
                  setPraticaAperturaBloccata(null);
                }}
              >
                Apri pratica
              </Link>
            </div>
          ) : null}

          {sessione.sessioneStato === "connecting" ? (
            <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-sm font-semibold text-sky-900">
                Chiamata in corso — in attesa di collegamento con il cliente
              </p>
              <p className="mt-1 text-xs text-sky-800">
                La pratica verrà aperta automaticamente quando la chiamata sarà collegata.
              </p>
            </div>
          ) : null}

          {sessione.sessioneStato === "post_call" && sessione.postCallFineAt ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="mb-1 text-sm font-semibold text-amber-900">Post-call — inserisci note ed esito</p>
              <PostCallTimer
                fineAt={sessione.postCallFineAt}
                onFinish={() =>
                  run(() => finishPostCallAction(sessione.campagnaId), "postcall")
                }
              />
              {sessione.praticaCorrenteId ? (
                <button
                  type="button"
                  className="mt-2 text-sm text-[var(--accent)] underline"
                  onClick={() => openPratica(sessione.praticaCorrenteId!)}
                >
                  Apri pratica
                </button>
              ) : null}
              <div className="mt-3">
                <button
                  type="button"
                  disabled={pending === "postcall"}
                  onClick={() => run(() => finishPostCallAction(sessione.campagnaId), "postcall")}
                  className="rounded border border-[var(--navy)] px-3 py-1.5 text-sm font-semibold text-[var(--navy)]"
                >
                  Torna disponibile ora
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {sessione.sessioneStato !== "pausa" && sessione.sessioneStato !== "fuori" ? (
              <button
                type="button"
                disabled={!!pending}
                onClick={() => run(() => pauseDialerAction(sessione.campagnaId), "pausa")}
                className="rounded border-2 border-orange-400 px-4 py-2 text-sm font-bold text-orange-800"
              >
                Pausa
              </button>
            ) : null}
            {sessione.sessioneStato === "pausa" ? (
              <button
                type="button"
                disabled={!!pending}
                onClick={() => run(() => resumeDialerAction(sessione.campagnaId), "resume")}
                className="rounded border-2 border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-800"
              >
                Riprendi
              </button>
            ) : null}
            <button
              type="button"
              disabled={!!pending}
              onClick={() => run(() => exitDialerAction(sessione.campagnaId), "exit")}
              className="rounded border-2 border-[var(--navy)] px-4 py-2 text-sm font-bold text-[var(--navy)]"
            >
              Esci dal dialer
            </button>
          </div>

          <p className="mt-3 text-xs text-[var(--muted)]">
            Chiamate: {sessione.chiamateCount} · Tempo totale: {Math.round(sessione.durataTotaleSec / 60)} min
          </p>
        </Card>
      ) : null}

      {invitiPending.length ? (
        <Card title="Campagne disponibili">
          <ul className="space-y-3">
            {invitiPending.map((inv) => (
              <li key={inv.campagna.id} className="rounded-lg border border-[var(--line)] p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{inv.campagna.nome}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {DIALER_CAMPAGNA_LABELS[inv.campagna.stato]}
                  </span>
                </div>
                {inv.campagna.descrizione ? (
                  <p className="mb-2 text-sm text-[var(--muted)]">{inv.campagna.descrizione}</p>
                ) : null}
                {inv.campagna.codiciScarico.length ? (
                  <p className="mb-2 text-xs">
                    Codici scarico:{" "}
                    <span className="font-mono">{inv.campagna.codiciScarico.join(", ")}</span>
                  </p>
                ) : null}
                <p className="mb-2 text-xs text-[var(--muted)]">
                  Post-call: {inv.campagna.postCallSec}s
                </p>
                <button
                  type="button"
                  disabled={pending === inv.campagna.id}
                  onClick={() =>
                    run(() => acceptDialerCampagnaAction(inv.campagna.id), inv.campagna.id)
                  }
                  className="rounded border-2 border-[var(--navy)] bg-[var(--navy)] px-4 py-2 text-sm font-bold text-white"
                >
                  Accetta e avvia dialer
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : !sessione ? (
        <Card title="Predictive Dialer">
          <p className="text-sm text-[var(--muted)]">
            Nessuna campagna attiva al momento. Attendi l&apos;invito del supervisor.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
