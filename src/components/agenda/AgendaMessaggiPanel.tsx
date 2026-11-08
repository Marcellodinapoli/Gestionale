"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ApriMessaggioIndipendente } from "@/components/agenda/ApriMessaggioIndipendente";
import { InviaMessaggioCollega } from "@/components/pratica/InviaMessaggioCollega";
import {
  SegnaMessaggioAgendaLettoButton,
  SegnaMessaggioInternoLettoButton,
} from "@/components/agenda/SegnaLettoButton";
import { GestisciMessaggioInviato } from "@/components/agenda/GestisciMessaggioInviato";
import { MessaggiInterniTuttiView } from "@/components/agenda/MessaggiInterniTuttiView";
import { groupConversazioniInterne } from "@/lib/messaggi/groupConversazioniInterne";
import type { MessaggioInternoSerialized } from "@/lib/messaggi/messaggioInternoUi";

export type { MessaggioInternoSerialized };

type FiltroMessaggi = "da_leggere" | "inviati" | "ricevuti" | "tutti";

function parseFiltroMessaggi(raw?: string): FiltroMessaggi {
  const v = raw?.trim().toLowerCase();
  if (v === "inviati") return "inviati";
  if (v === "ricevuti" || v === "letti") return "ricevuti";
  if (v === "tutti") return "tutti";
  return "da_leggere";
}

export type MessaggioAgendaSerialized = {
  id: string;
  praticaId: string;
  praticaNumero: string;
  debitore: string;
  line: string;
  autore: string;
  autoreUserId: string;
  createdAt: string;
  letto: boolean;
  lettoAt: string | null;
};

function formatData(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BadgeStato({
  inviato,
  letto,
}: {
  inviato?: boolean;
  letto: boolean;
}) {
  const cls = inviato
    ? letto
      ? "bg-sky-100 text-sky-800"
      : "bg-indigo-100 text-indigo-800"
    : letto
      ? "bg-slate-100 text-slate-700"
      : "bg-amber-100 text-amber-800";
  const label = inviato
    ? letto
      ? "Inviato · letto"
      : "Inviato · in attesa"
    : letto
      ? "Letto"
      : "Da leggere";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
  );
}

export function AgendaMessaggiPanel({
  userId,
  interni,
  messaggiPratica,
  filtroRaw,
}: {
  userId: string;
  interni: MessaggioInternoSerialized[];
  messaggiPratica: MessaggioAgendaSerialized[];
  filtroRaw?: string;
}) {
  const [nuovoOpen, setNuovoOpen] = useState(false);
  const filtro = parseFiltroMessaggi(filtroRaw);

  const ricevuti = useMemo(
    () => interni.filter((m) => m.toUserId === userId),
    [interni, userId]
  );
  const inviati = useMemo(
    () => interni.filter((m) => m.fromUserId === userId),
    [interni, userId]
  );

  const daLeggereColleghi = ricevuti.filter((m) => !m.letto).length;
  const daLeggerePratiche = messaggiPratica.filter((m) => !m.letto).length;

  const colleghiFiltrati = useMemo(() => {
    if (filtro === "inviati") return inviati;
    if (filtro === "ricevuti") {
      return [...ricevuti].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    if (filtro === "tutti") {
      return [...ricevuti, ...inviati].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return ricevuti.filter((m) => !m.letto);
  }, [filtro, ricevuti, inviati]);

  const conversazioniTutti = useMemo(() => {
    if (filtro !== "tutti") return [];
    return groupConversazioniInterne(colleghiFiltrati, userId);
  }, [filtro, colleghiFiltrati, userId]);

  const praticheFiltrati = useMemo(() => {
    if (filtro === "inviati") return [];
    if (filtro === "ricevuti" || filtro === "tutti") return messaggiPratica;
    return messaggiPratica.filter((m) => !m.letto);
  }, [filtro, messaggiPratica]);

  const totaleRicevuti = ricevuti.length + messaggiPratica.length;

  function hrefFiltro(f: FiltroMessaggi) {
    if (f === "da_leggere") return "/messaggi";
    return `/messaggi?filtro=${f}`;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-amber-800">Da leggere</p>
          <p className="text-2xl font-bold text-amber-900">{daLeggereColleghi + daLeggerePratiche}</p>
          <p className="text-xs text-amber-800">
            {daLeggereColleghi} da interni · {daLeggerePratiche} su pratiche
          </p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-indigo-800">Inviati</p>
          <p className="text-2xl font-bold text-indigo-900">{inviati.length}</p>
          <p className="text-xs text-indigo-800">Messaggi interni inviati</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-slate-600">Ricevuti</p>
          <p className="text-2xl font-bold text-slate-800">{totaleRicevuti}</p>
          <p className="text-xs text-slate-600">
            {ricevuti.length} da interni · {messaggiPratica.length} su pratiche
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["da_leggere", "Da leggere"],
              ["inviati", "Inviati"],
              ["ricevuti", "Ricevuti"],
              ["tutti", "Tutti"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={hrefFiltro(key)}
              className={`rounded-lg px-3 py-1.5 ${
                filtro === key ? "bg-[#132033] text-white" : "border border-[var(--line)] bg-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNuovoOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuovo messaggio
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-sky-200 bg-white">
        <div className="border-b border-sky-200 bg-sky-100/90 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-sky-950">
          Messaggio interno
        </div>
        <ul className="divide-y divide-[var(--line)] text-sm">
          {filtro === "tutti" ? (
            <MessaggiInterniTuttiView userId={userId} conversazioni={conversazioniTutti} />
          ) : (
            <>
              {colleghiFiltrati.map((m) => {
                const inviato = m.fromUserId === userId;
                const indipendente = !m.praticaId;
                return (
                  <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--muted)]">
                        {inviato ? `Inviato a ${m.toName}` : `Ricevuto da ${m.fromName}`}
                        {indipendente ? " · senza pratica" : ""}
                      </p>
                      {m.praticaId ? (
                        <p className="mt-0.5">
                          <Link
                            className="font-medium text-[var(--accent)] underline"
                            href={`/pratiche/${m.praticaId}`}
                          >
                            {m.praticaNumero}
                          </Link>
                          {m.debitore ? ` · ${m.debitore}` : null}
                        </p>
                      ) : null}
                      {!inviato ? (
                        <ApriMessaggioIndipendente
                          fromName={m.fromName}
                          fromUserId={m.fromUserId}
                          testo={m.testo}
                          createdAtLabel={formatData(m.createdAt)}
                          praticaId={m.praticaId}
                        />
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap">{m.testo}</p>
                      )}
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatData(m.createdAt)}
                        {m.lettoAt ? ` · letto ${formatData(m.lettoAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <BadgeStato inviato={inviato} letto={m.letto} />
                      {inviato ? (
                        <GestisciMessaggioInviato messageId={m.id} testoIniziale={m.testo} />
                      ) : null}
                      {!inviato && !m.letto ? (
                        <SegnaMessaggioInternoLettoButton
                          messageId={m.id}
                          label="Setta già letto"
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {!colleghiFiltrati.length ? (
                <li className="px-3 py-6 text-center text-[var(--muted)]">
                  Nessun messaggio in questa sezione.
                </li>
              ) : null}
            </>
          )}
        </ul>
      </div>

      {filtro !== "inviati" ? (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
          <div className="border-b border-amber-200 bg-amber-100/90 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-amber-950">
            Messaggi su pratiche
          </div>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {praticheFiltrati.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                <div>
                  <Link
                    className="font-medium text-[var(--accent)] underline"
                    href={`/pratiche/${m.praticaId}`}
                  >
                    {m.praticaNumero}
                  </Link>{" "}
                  {m.debitore}
                  {m.autoreUserId && m.autoreUserId !== userId ? (
                    <ApriMessaggioIndipendente
                      fromName={m.autore}
                      fromUserId={m.autoreUserId}
                      testo={m.line}
                      createdAtLabel={`${formatData(m.createdAt)}`}
                      praticaId={m.praticaId}
                    />
                  ) : (
                    <p className="mt-1 font-mono text-xs">{m.line}</p>
                  )}
                  <p className="text-xs text-[var(--muted)]">
                    {m.autore} · {formatData(m.createdAt)}
                    {m.lettoAt ? ` · letto ${formatData(m.lettoAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <BadgeStato letto={m.letto} />
                  {!m.letto ? <SegnaMessaggioAgendaLettoButton messageId={m.id} /> : null}
                </div>
              </li>
            ))}
            {!praticheFiltrati.length ? (
              <li className="px-3 py-6 text-center text-[var(--muted)]">
                Nessun messaggio su pratiche in questa sezione.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <Modal open={nuovoOpen} title="Nuovo messaggio a un collega" onClose={() => setNuovoOpen(false)} wide>
        <div className="min-h-[28rem] p-3">
          <InviaMessaggioCollega standalone />
        </div>
      </Modal>
    </div>
  );
}
