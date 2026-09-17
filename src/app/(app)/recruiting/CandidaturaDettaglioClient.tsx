"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { aggiornaStatoCandidaturaAction } from "@/actions/recruiting";
import {
  STATO_CANDIDATURA_LABELS,
  transizioniConsentiteCandidatura,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";
import {
  messaggioConfermaStatoTerminale,
  type SuggerimentoTransizione,
} from "@/lib/recruiting/attivita";

const STEPS_PRINCIPALI: StatoCandidatura[] = [
  "RICEVUTA",
  "IN_VALUTAZIONE",
  "COLLOQUIO",
  "PROVA",
  "ASSUNTA",
];

const PASSI_PROCEDURA = [
  "Ricezione della candidatura",
  "Registra contatto o nota",
  "Passa a In valutazione",
  "Programma colloquio",
  "Passa a Colloquio",
  "Segna come svolto",
  "Registra esito",
  "Passa a Prova",
  "Assunto/a",
] as const;

function etichettaAzioneStato(stato: StatoCandidatura): string {
  if (stato === "IN_VALUTAZIONE") return "Passa a In valutazione";
  if (stato === "COLLOQUIO") return "Passa a Colloquio";
  if (stato === "PROVA") return "Passa a Prova";
  if (stato === "ASSUNTA") return "Assunto/a";
  if (stato === "ARCHIVIATA") return "Archivia candidatura";
  return STATO_CANDIDATURA_LABELS[stato];
}

function ProceduraOperativa({
  passoCorrente,
  archiviata,
}: {
  passoCorrente: number;
  archiviata: boolean;
}) {
  return (
    <div className="mt-4 border-t border-[var(--line)] pt-3">
      <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Procedura</p>
      <ol className="mt-2 space-y-1 text-sm">
        {PASSI_PROCEDURA.map((label, i) => {
          const n = i + 1;
          const done = !archiviata && n < passoCorrente;
          const current = !archiviata && n === passoCorrente;
          return (
            <li
              key={label}
              className={
                current
                  ? "font-semibold text-[var(--navy)]"
                  : done
                    ? "text-emerald-800"
                    : "text-[var(--muted)]"
              }
            >
              <span className="tabular-nums">{n}.</span> {label}
              {current ? " ← adesso" : done ? " ✓" : ""}
            </li>
          );
        })}
        <li
          className={
            archiviata ? "font-semibold text-stone-800" : "text-[var(--muted)]"
          }
        >
          Alternativa: Archivia candidatura
          {archiviata ? " ← adesso" : ""}
        </li>
      </ol>
    </div>
  );
}

function classeStep(kind: "done" | "current" | "future" | "archive") {
  if (kind === "current") {
    return "bg-[var(--navy)] text-white ring-2 ring-[var(--navy)] ring-offset-2";
  }
  if (kind === "done") return "bg-emerald-100 text-emerald-900";
  if (kind === "archive") return "bg-stone-700 text-white";
  return "bg-slate-100 text-slate-500";
}

function PercorsoCandidatura({ stato }: { stato: StatoCandidatura }) {
  const currentIdx = STEPS_PRINCIPALI.indexOf(stato);
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
  canManage,
  suggerimento,
  hasColloquiAperti,
  passoProcedura,
}: {
  candidatura: {
    id: string;
    stato: StatoCandidatura;
  };
  canManage: boolean;
  suggerimento: SuggerimentoTransizione | null;
  hasColloquiAperti: boolean;
  passoProcedura: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmTo, setConfirmTo] = useState<"ASSUNTA" | "ARCHIVIATA" | null>(null);
  const next = transizioniConsentiteCandidatura(candidatura.stato);
  const primaria = suggerimento?.to && next.includes(suggerimento.to) ? suggerimento.to : null;
  const secondarie = next.filter((s) => s !== primaria);

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

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--line)] bg-white p-4">
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
        <ProceduraOperativa
          passoCorrente={passoProcedura}
          archiviata={candidatura.stato === "ARCHIVIATA"}
        />
      </div>

      {canManage && (suggerimento || next.length > 0) ? (
        <div className="grid max-w-xl gap-3 rounded-xl border border-[var(--line)] bg-white p-4 text-sm">
          {suggerimento ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {suggerimento.messaggio}
            </p>
          ) : null}
          {next.length > 0 ? (
            <div className="flex flex-wrap gap-2">
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
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-800">{error}</p> : null}
        </div>
      ) : null}

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
