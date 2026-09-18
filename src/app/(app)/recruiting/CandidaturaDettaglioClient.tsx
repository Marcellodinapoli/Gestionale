"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  aggiornaStatoCandidaturaAction,
  aggiungiNotaCandidaturaAction,
  creaColloquioAction,
  creaProvaAction,
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
  messaggioConfermaStatoTerminale,
  type SuggerimentoTransizione,
} from "@/lib/recruiting/attivita";
import {
  MODALITA_COLLOQUIO,
  MODALITA_COLLOQUIO_LABELS,
} from "@/lib/recruiting/colloqui";

const STEPS_PRINCIPALI: StatoCandidatura[] = [
  "RICEVUTA",
  "IN_VALUTAZIONE",
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
  if (stato === "IN_VALUTAZIONE") return "Passa a In valutazione";
  if (stato === "COLLOQUIO") return "Passa a Colloquio";
  if (stato === "PROVA") return "Passa a Prova";
  if (stato === "ASSUNTA") return "Assunto/a";
  if (stato === "ARCHIVIATA") return "Archivia candidatura";
  return STATO_CANDIDATURA_LABELS[stato];
}

function ProceduraOperativa({ stato }: { stato: StatoCandidatura }) {
  const currentIdx = STEPS_PRINCIPALI.indexOf(stato);
  const archiviata = stato === "ARCHIVIATA";
  return (
    <div className="mt-4 border-t border-[var(--line)] pt-3">
      <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Procedura</p>
      <ol className="mt-2 space-y-1 text-sm">
        {STEPS_PRINCIPALI.map((step, i) => {
          const n = i + 1;
          const current = !archiviata && currentIdx === i;
          const done = !archiviata && currentIdx > i;
          return (
            <li
              key={step}
              className={
                current
                  ? "font-semibold text-[var(--navy)]"
                  : done
                    ? "text-emerald-800"
                    : "text-[var(--muted)]"
              }
            >
              <span className="tabular-nums">{n}.</span> {STATO_CANDIDATURA_LABELS[step]}
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
  operabile,
  canCreateColloquio,
  utenti,
  suggerimento,
  hasColloquiAperti,
  contatto,
}: {
  candidatura: {
    id: string;
    stato: StatoCandidatura;
    cognome: string;
    nome: string;
  };
  canManage: boolean;
  operabile: boolean;
  canCreateColloquio: boolean;
  utenti: Array<{ id: string; name: string }>;
  suggerimento: SuggerimentoTransizione | null;
  hasColloquiAperti: boolean;
  contatto: {
    id: string;
    canale: string;
    esito: string;
    occurredAt: string;
    note: string;
  } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmTo, setConfirmTo] = useState<"ASSUNTA" | "ARCHIVIATA" | null>(null);
  const [modal, setModal] = useState<"contatto" | "colloquio" | "prova" | "nota" | null>(null);
  const inRicevuta = candidatura.stato === "RICEVUTA";
  const hasContatto = Boolean(contatto);
  const modificaContatto = !inRicevuta && hasContatto;
  const contattoObbligatorio = inRicevuta && !hasContatto;
  const colloquioObbligatorio = candidatura.stato === "IN_VALUTAZIONE";
  const provaObbligatoria = candidatura.stato === "COLLOQUIO";
  const next = transizioniConsentiteCandidatura(candidatura.stato);
  const passaA = next.filter((s) => s !== "ARCHIVIATA" && s !== "COLLOQUIO" && s !== "PROVA");
  const canArchivia = next.includes("ARCHIVIATA");
  const primaria =
    suggerimento?.to &&
    passaA.includes(suggerimento.to) &&
    suggerimento.to !== "IN_VALUTAZIONE"
      ? suggerimento.to
      : null;
  const secondarie = passaA.filter((s) => s !== primaria);
  const showAzioni = canManage && (operabile || next.length > 0);

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
        </div>
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
        <ProceduraOperativa stato={candidatura.stato} />
      </div>

      {showAzioni ? (
        <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-white p-4 text-sm">
          {suggerimento ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {suggerimento.messaggio}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {operabile && canCreateColloquio ? (
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
                  setError(null);
                  setModal("prova");
                }}
                className={btnOutline}
              >
                Programma prova *
              </button>
            ) : null}
            {operabile ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setModal("contatto");
                }}
                className={btnOutline}
              >
                {modificaContatto ? "Modifica contatto" : "Registra contatto"}
                {contattoObbligatorio ? " *" : ""}
              </button>
            ) : null}
            {operabile ? (
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
          </div>
          {error ? <p className="text-sm text-rose-800">{error}</p> : null}
        </div>
      ) : null}

      <Modal
        open={modal === "contatto"}
        title={modificaContatto ? "Modifica contatto" : "Registra contatto"}
        onClose={() => !pending && setModal(null)}
      >
        <form
          key={modificaContatto ? contatto?.id ?? "edit" : "new"}
          className="grid gap-3 p-4 text-sm"
          action={(fd) =>
            runAction(
              fd,
              modificaContatto ? modificaContattoCandidaturaAction : registraContattoCandidaturaAction,
              () => setModal(null)
            )
          }
        >
          <input type="hidden" name="candidaturaId" value={candidatura.id} />
          {modificaContatto && contatto ? <input type="hidden" name="id" value={contatto.id} /> : null}
          {contattoObbligatorio ? (
            <p className="text-xs font-medium text-amber-900">
              Obbligatorio in fase Ricevuta: senza contatto non si può passare a In valutazione.
            </p>
          ) : null}
          <p className="text-xs text-[var(--muted)]">
            Nessun numero, email o recapito. Solo canale, esito e nota operativa.
          </p>
          <label>
            <span className={labelCls}>Canale</span>
            <select
              name="canale"
              defaultValue={modificaContatto && contatto ? contatto.canale : "TELEFONO"}
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
              defaultValue={modificaContatto && contatto ? contatto.esito : "RAGGIUNTO"}
              className={inputCls}
            >
              {ESITI_CONTATTO.map((e) => (
                <option key={e} value={e}>
                  {ESITO_CONTATTO_LABELS[e]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Data e ora</span>
            <input
              type="datetime-local"
              name="occurredAt"
              defaultValue={datetimeLocalValue(
                modificaContatto && contatto ? contatto.occurredAt : undefined
              )}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Nota</span>
            <textarea
              name="note"
              maxLength={2000}
              rows={3}
              defaultValue={modificaContatto && contatto ? contatto.note : ""}
              className={`${inputCls} h-auto py-2`}
            />
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
              {pending ? "Salvataggio…" : modificaContatto ? "Salva" : "Registra"}
            </button>
          </div>
        </form>
      </Modal>

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
            <span className={labelCls}>Testo</span>
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
          className="grid gap-3 p-4 text-sm"
          action={(fd) => runAction(fd, creaColloquioAction, () => setModal(null))}
        >
          <input type="hidden" name="candidaturaId" value={candidatura.id} />
          {colloquioObbligatorio ? (
            <p className="text-xs font-medium text-amber-900">
              Data e ora obbligatorie: programmare il colloquio fa passare la candidatura a Colloquio.
            </p>
          ) : null}
          <label>
            <span className={labelCls}>Data e ora</span>
            <input
              type="datetime-local"
              name="scheduledAt"
              required
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
            <span className={labelCls}>Intervistatore</span>
            <select name="intervistatoreUserId" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {utenti.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Referente</span>
            <input name="intervistatoreLabel" maxLength={120} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Note preliminari</span>
            <textarea name="notePreliminari" maxLength={2000} rows={3} className={`${inputCls} h-auto py-2`} />
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
              {pending ? "Salvataggio…" : "Programma"}
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
          className="grid gap-3 p-4 text-sm"
          action={(fd) => runAction(fd, creaProvaAction, () => setModal(null))}
        >
          <input type="hidden" name="candidaturaId" value={candidatura.id} />
          <p className="text-xs font-medium text-amber-900">
            Data e ora obbligatorie: programmare la prova fa passare la candidatura a Prova.
          </p>
          <label>
            <span className={labelCls}>Data e ora</span>
            <input
              type="datetime-local"
              name="scheduledAt"
              required
              defaultValue={datetimeLocalValue()}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Nota</span>
            <textarea name="note" maxLength={2000} rows={3} className={`${inputCls} h-auto py-2`} />
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
              {pending ? "Salvataggio…" : "Programma"}
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
