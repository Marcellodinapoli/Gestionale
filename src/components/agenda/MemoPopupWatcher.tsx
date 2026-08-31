"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  markMemoLettoAction,
  markMessaggioInternoLettoAction,
  postponeMemoPraticaAction,
} from "@/actions/core";
import type { MemoAlertPayload } from "@/lib/memoAlerts";
import { subscribeMemoAlerts } from "@/lib/realtime/RealtimeService";
import { operatorSigla } from "@/lib/noteFormat";

function MemoPopup({
  alert,
  total,
  userName,
  onDone,
}: {
  alert: MemoAlertPayload;
  total: number;
  userName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sigla = operatorSigla(userName);
  const isCollega = alert.kind === "collega";
  const isSanzione = alert.kind === "sanzione";
  const isMsgInterno = isCollega || isSanzione;

  async function run(fn: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await fn();
      onDone();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-[100] w-[min(420px,calc(100vw-2rem))] border-2 shadow-2xl ${
        isSanzione
          ? "border-red-700 bg-[#fff5f5]"
          : "border-[#5ec4c4] bg-[#ece9d8]"
      }`}
    >
      <div
        className={`flex items-center justify-between px-2 py-1 text-xs font-bold text-white ${
          isSanzione ? "bg-red-700" : "bg-[#808000]"
        }`}
      >
        <span className="flex items-center gap-1">
          <span aria-hidden>{isSanzione ? "⚠" : "✉"}</span>{" "}
          {isSanzione ? "Sanzione attiva" : `Msg per ${sigla}`}
        </span>
        <button
          type="button"
          onClick={onDone}
          className="px-1 leading-none hover:bg-white/20"
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>

      <div
        className={`border-b border-[#c0c0c0] px-2 py-1 text-center ${
          isSanzione ? "bg-red-100" : "bg-[#ffffcc]"
        }`}
      >
        <span className="text-sm font-bold text-red-700">
          {isSanzione ? "Incasso massivo mandato" : `Impegni: ${total}`}
        </span>
      </div>

      <div className="space-y-1 p-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-6 shrink-0">da</span>
          <span className="border border-[#808080] bg-white px-2 py-0.5 font-bold">
            {alert.fromSigla}
          </span>
          <span
            className={`flex-1 border border-[#808080] px-2 py-0.5 font-semibold ${
              isSanzione ? "bg-red-50" : "bg-[#ffffcc]"
            }`}
          >
            {alert.fromName}
          </span>
        </div>

        {isMsgInterno ? (
          <Link
            href={alert.praticaId ? `/pratiche/${alert.praticaId}` : "/messaggi"}
            className={`block min-h-[72px] whitespace-pre-wrap border p-2 font-mono text-sm leading-snug hover:bg-[#f7fbff] ${
              isSanzione
                ? "border-red-400 bg-white font-semibold text-red-900"
                : "border-[#808080] bg-white"
            }`}
          >
            {alert.line}
            <span className="mt-2 block text-xs font-sans font-semibold text-[#1a73e8]">
              {alert.praticaId
                ? `Clicca per aprire la pratica ${alert.numero}`
                : "Clicca per aprire Messaggi"}
            </span>
          </Link>
        ) : (
          <div className="min-h-[72px] whitespace-pre-wrap border border-[#808080] bg-white p-2 font-mono text-sm leading-snug">
            {alert.line}
          </div>
        )}

        {error ? <p className="text-[var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const fd = new FormData();
                if (isMsgInterno && alert.id) {
                  fd.set("messageId", alert.id);
                  await markMessaggioInternoLettoAction(fd);
                } else if (alert.praticaId) {
                  fd.set("praticaId", alert.praticaId);
                  await markMemoLettoAction(fd);
                }
              })
            }
            className="border border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] px-2 py-1 text-xs hover:from-[#fafafa] disabled:opacity-50"
          >
            Setta già letto
          </button>
          {isMsgInterno && !alert.praticaId ? (
            <Link
              href="/messaggi"
              className="border border-dotted border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] px-2 py-1 text-xs font-semibold hover:from-[#fafafa]"
            >
              apri messaggi
            </Link>
          ) : alert.praticaId ? (
            <Link
              href={`/pratiche/${alert.praticaId}`}
              className={
                isMsgInterno
                  ? "border border-dotted border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] px-2 py-1 text-xs font-semibold hover:from-[#fafafa]"
                  : "border border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] px-2 py-1 text-xs hover:from-[#fafafa]"
              }
            >
              apri pratica
            </Link>
          ) : null}
          {!isMsgInterno ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    if (!alert.praticaId) return;
                    const fd = new FormData();
                    fd.set("praticaId", alert.praticaId);
                    fd.set("mode", "sposta");
                    await postponeMemoPraticaAction(fd);
                  })
                }
                className="border border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] px-2 py-1 text-xs hover:from-[#fafafa] disabled:opacity-50"
              >
                sposta (+30 min)
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    if (!alert.praticaId) return;
                    const fd = new FormData();
                    fd.set("praticaId", alert.praticaId);
                    fd.set("mode", "domani");
                    await postponeMemoPraticaAction(fd);
                  })
                }
                className="border border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] px-2 py-1 text-xs hover:from-[#fafafa] disabled:opacity-50"
              >
                domani
              </button>
              <Link
                href="/agenda"
                className="ml-auto border border-dotted border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] px-2 py-1 text-xs font-semibold hover:from-[#fafafa]"
              >
                Apri Agenda
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MemoPopupWatcher({ userName }: { userName: string }) {
  const [alert, setAlert] = useState<MemoAlertPayload | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    return subscribeMemoAlerts({
      onUpdate: (data) => {
        setTotal(data.total);
        setAlert((data.alerts[0] as MemoAlertPayload | undefined) ?? null);
      },
    });
  }, []);

  if (!alert) return null;

  return (
    <MemoPopup
      alert={alert}
      total={total}
      userName={userName}
      onDone={() => {
        setAlert(null);
      }}
    />
  );
}
