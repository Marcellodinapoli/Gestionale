"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  annullaColloquioAction,
  chiudiColloquioAction,
  svolgiColloquioAction,
} from "@/actions/recruiting";
import {
  ESITI_COLLOQUIO,
  ESITO_COLLOQUIO_LABELS,
  MODALITA_COLLOQUIO_LABELS,
  STATO_COLLOQUIO_LABELS,
  type EsitoColloquio,
  type ModalitaColloquio,
  type StatoColloquio,
} from "@/lib/recruiting/colloqui";
import { MESSAGGIO_CONFERMA_ANNULLA_COLLOQUIO } from "@/lib/recruiting/attivita";
import type { StatoCandidatura } from "@/lib/recruiting/candidature";

type ColloquioRow = {
  id: string;
  round: number;
  stato: StatoColloquio;
  scheduledAt: string;
  modalita: ModalitaColloquio;
  intervistatoreNome: string;
  notePreliminari: string;
  noteSvolgimento: string;
  esito: EsitoColloquio | null;
  valutazione: string;
};

const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

const STATO_COLLOQUIO_COLORS: Record<StatoColloquio, string> = {
  PROGRAMMATO: "bg-amber-100 text-amber-900",
  SVOLTO: "bg-sky-100 text-sky-900",
  ESITATO: "bg-emerald-100 text-emerald-800",
  ANNULLATO: "bg-stone-200 text-stone-700",
};

function etichettaRound(round: number) {
  return `${round}° colloquio`;
}

export function CandidaturaColloquiClient({
  statoCandidatura,
  colloqui,
  canManage,
}: {
  candidaturaId: string;
  statoCandidatura: StatoCandidatura;
  colloqui: ColloquioRow[];
  utenti: Array<{ id: string; name: string }>;
  canManage: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [svolgi, setSvolgi] = useState<ColloquioRow | null>(null);
  const [chiudi, setChiudi] = useState<ColloquioRow | null>(null);
  const [annulla, setAnnulla] = useState<ColloquioRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fd: FormData, action: (data: FormData) => Promise<void>, onOk: () => void) {
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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Colloqui</h2>
      </div>
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {colloqui.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
          {statoCandidatura === "RICEVUTA"
            ? "Prima registra un contatto o una nota e porta la candidatura in valutazione per programmare un colloquio."
            : "Nessun colloquio per questa candidatura."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Colloquio</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Modalità</th>
                <th className="px-3 py-2">Referente</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Esito</th>
                {canManage ? <th className="px-3 py-2 text-right">Azioni</th> : null}
              </tr>
            </thead>
            <tbody>
              {colloqui.map((c) => {
                const aperto = c.stato === "PROGRAMMATO" || c.stato === "SVOLTO";
                const hasNote =
                  Boolean(c.notePreliminari) ||
                  Boolean(c.noteSvolgimento) ||
                  Boolean(c.valutazione);
                const colSpan = canManage ? 7 : 6;
                return (
                  <Fragment key={c.id}>
                    <tr
                      id={`colloquio-${c.id}`}
                      className={`scroll-mt-24 border-t border-[var(--line)] ${aperto ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">{etichettaRound(c.round)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {new Date(c.scheduledAt).toLocaleString("it-IT")}
                      </td>
                      <td className="px-3 py-2">{MODALITA_COLLOQUIO_LABELS[c.modalita]}</td>
                      <td className="px-3 py-2">{c.intervistatoreNome}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATO_COLLOQUIO_COLORS[c.stato]}`}
                        >
                          {STATO_COLLOQUIO_LABELS[c.stato]}
                          {aperto ? " · aperto" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {c.esito ? ESITO_COLLOQUIO_LABELS[c.esito] : ""}
                      </td>
                      {canManage ? (
                        <td className="px-3 py-2 text-right">
                          {c.stato === "PROGRAMMATO" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={pending}
                                className="text-xs font-semibold text-[var(--accent)] underline"
                                onClick={() => {
                                  setError(null);
                                  setSvolgi(c);
                                }}
                              >
                                Segna come svolto
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                className="text-xs font-semibold text-rose-800 underline"
                                onClick={() => {
                                  setError(null);
                                  setAnnulla(c);
                                }}
                              >
                                Annulla
                              </button>
                            </div>
                          ) : c.stato === "SVOLTO" ? (
                            <button
                              type="button"
                              disabled={pending}
                              className="text-xs font-semibold text-[var(--accent)] underline"
                              onClick={() => {
                                setError(null);
                                setChiudi(c);
                              }}
                            >
                              Registra esito
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                    {hasNote ? (
                      <tr className={aperto ? "bg-amber-50" : ""}>
                        <td colSpan={colSpan} className="px-3 pb-3">
                          <div className="grid gap-2 sm:grid-cols-3">
                            {c.notePreliminari ? (
                              <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                                  Note preliminari
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">
                                  {c.notePreliminari}
                                </p>
                              </div>
                            ) : null}
                            {c.noteSvolgimento ? (
                              <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                                  Note svolgimento
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">
                                  {c.noteSvolgimento}
                                </p>
                              </div>
                            ) : null}
                            {c.valutazione ? (
                              <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                                  Valutazione
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">
                                  {c.valutazione}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!annulla}
        title="Annulla colloquio"
        onClose={() => !pending && setAnnulla(null)}
      >
        {annulla ? (
          <div className="grid gap-3 p-4 text-sm">
            <p>{MESSAGGIO_CONFERMA_ANNULLA_COLLOQUIO}</p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setAnnulla(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Indietro
              </button>
              <button
                type="button"
                disabled={pending}
                className="h-9 rounded-lg bg-rose-800 px-3 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", annulla.id);
                  run(fd, annullaColloquioAction, () => setAnnulla(null));
                }}
              >
                {pending ? "Salvataggio…" : "Conferma annullamento"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!svolgi} title="Segna come svolto" onClose={() => !pending && setSvolgi(null)}>
        {svolgi ? (
          <form
            className="grid gap-3 p-4 text-sm"
            action={(fd) => run(fd, svolgiColloquioAction, () => setSvolgi(null))}
          >
            <input type="hidden" name="id" value={svolgi.id} />
            <label>
              <span className={labelCls}>Note svolgimento</span>
              <textarea
                name="noteSvolgimento"
                maxLength={2000}
                rows={3}
                defaultValue={svolgi.noteSvolgimento}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setSvolgi(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Salvataggio…" : "Conferma svolto"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!chiudi} title="Registra esito" onClose={() => !pending && setChiudi(null)}>
        {chiudi ? (
          <form
            className="grid gap-3 p-4 text-sm"
            action={(fd) => run(fd, chiudiColloquioAction, () => setChiudi(null))}
          >
            <input type="hidden" name="id" value={chiudi.id} />
            <label>
              <span className={labelCls}>Esito</span>
              <select name="esito" required className={inputCls}>
                <option value="">Seleziona</option>
                {ESITI_COLLOQUIO.map((e) => (
                  <option key={e} value={e}>
                    {ESITO_COLLOQUIO_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Valutazione</span>
              <textarea name="valutazione" maxLength={2000} rows={3} className={`${inputCls} h-auto py-2`} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setChiudi(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Salvataggio…" : "Registra esito"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}
