"use client";

import Link from "next/link";
import { ApriMessaggioIndipendente } from "@/components/agenda/ApriMessaggioIndipendente";
import type { MessaggioInternoSerialized } from "@/lib/messaggi/messaggioInternoUi";
import { GestisciMessaggioInviato } from "@/components/agenda/GestisciMessaggioInviato";
import { SegnaMessaggioInternoLettoButton } from "@/components/agenda/SegnaLettoButton";
import type { ConversazioneInternaGruppo } from "@/lib/messaggi/groupConversazioniInterne";

function formatData(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BubbleRicevuto({
  m,
  formatDataFn,
}: {
  m: MessaggioInternoSerialized;
  formatDataFn: (iso: string) => string;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[min(100%,28rem)] rounded-xl rounded-tl-sm border border-emerald-200 bg-emerald-50/80 px-3 py-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          Ricevuto · {m.fromName}
        </p>
        <ApriMessaggioIndipendente
          fromName={m.fromName}
          fromUserId={m.fromUserId}
          testo={m.testo}
          createdAtLabel={formatDataFn(m.createdAt)}
          praticaId={m.praticaId}
        />
        <p className="mt-1 text-[10px] text-emerald-900/70">
          {formatDataFn(m.createdAt)}
          {m.lettoAt ? ` · letto ${formatDataFn(m.lettoAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

function BubbleInviato({
  m,
  formatDataFn,
  etichetta,
}: {
  m: MessaggioInternoSerialized;
  formatDataFn: (iso: string) => string;
  etichetta: "Messaggio inviato" | "Tua risposta";
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(100%,28rem)] rounded-xl rounded-tr-sm border border-sky-200 bg-sky-50/90 px-3 py-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900">
          {etichetta} · a {m.toName}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">{m.testo}</p>
        <p className="mt-1 text-[10px] text-sky-900/70">
          {formatDataFn(m.createdAt)}
          {m.letto
            ? m.lettoAt
              ? ` · letto dal destinatario ${formatDataFn(m.lettoAt)}`
              : " · letto dal destinatario"
            : " · in attesa di lettura"}
        </p>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <GestisciMessaggioInviato messageId={m.id} testoIniziale={m.testo} />
        </div>
      </div>
    </div>
  );
}

export function MessaggiInterniTuttiView({
  userId,
  conversazioni,
}: {
  userId: string;
  conversazioni: ConversazioneInternaGruppo[];
}) {
  if (!conversazioni.length) {
    return (
      <li className="px-3 py-6 text-center text-[var(--muted)]">
        Nessun messaggio in questa sezione.
      </li>
    );
  }

  return (
    <>
      {conversazioni.map((conv) => {
        const indipendente = !conv.praticaId;
        const nonLetti = conv.messaggi.filter(
          (m) => m.toUserId === userId && !m.letto
        ).length;

        const headerTone = indipendente
          ? "border-violet-200 bg-violet-100/90 text-violet-950"
          : "border-teal-200 bg-teal-100/90 text-teal-950";
        const threadTone = indipendente ? "bg-violet-50/40" : "bg-teal-50/40";

        return (
          <li
            key={conv.key}
            className={`border-b border-[var(--line)] px-3 py-4 last:border-b-0 ${threadTone}`}
          >
            <div
              className={`mb-3 flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2.5 ${headerTone}`}
            >
              <div>
                <p className="text-sm font-semibold">
                  Conversazione con {conv.controparteName}
                </p>
                <p className="text-xs opacity-80">
                  {indipendente ? "Messaggi liberi (senza pratica)" : "Messaggi sulla stessa pratica"}
                </p>
                {conv.praticaId ? (
                  <p className="mt-0.5 text-xs">
                    <Link
                      className="font-medium text-[var(--accent)] underline"
                      href={`/pratiche/${conv.praticaId}`}
                    >
                      {conv.praticaNumero}
                    </Link>
                    {conv.debitore ? ` · ${conv.debitore}` : null}
                  </p>
                ) : null}
              </div>
              <div className="text-right text-xs opacity-80">
                <p>{conv.messaggi.length} messaggi</p>
                <p>Ultimo: {formatData(conv.ultimoAt)}</p>
                {nonLetti > 0 ? (
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                    {nonLetti} da leggere
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {conv.messaggi.map((m, index) => {
                const inviato = m.fromUserId === userId;
                const prev = index > 0 ? conv.messaggi[index - 1] : null;
                if (inviato) {
                  const etichetta =
                    prev && prev.fromUserId !== userId ? "Tua risposta" : "Messaggio inviato";
                  return (
                    <BubbleInviato
                      key={m.id}
                      m={m}
                      formatDataFn={formatData}
                      etichetta={etichetta}
                    />
                  );
                }
                return (
                  <div key={m.id} className="space-y-2">
                    <BubbleRicevuto m={m} formatDataFn={formatData} />
                    {!m.letto ? (
                      <div className="flex justify-start pl-1">
                        <SegnaMessaggioInternoLettoButton
                          messageId={m.id}
                          label="Setta già letto"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </>
  );
}
