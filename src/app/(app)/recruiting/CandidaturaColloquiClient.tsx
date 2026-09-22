"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { aggiornaColloquioAction, svolgiColloquioAction } from "@/actions/recruiting";
import {
  ESITI_COLLOQUIO,
  ESITO_COLLOQUIO_LABELS,
  MODALITA_COLLOQUIO,
  MODALITA_COLLOQUIO_LABELS,
  STATO_COLLOQUIO_LABELS,
  type EsitoColloquio,
  type ModalitaColloquio,
  type StatoColloquio,
} from "@/lib/recruiting/colloqui";
import type { StatoCandidatura } from "@/lib/recruiting/candidature";
import { STATO_CANDIDATURA_LABELS } from "@/lib/recruiting/candidature";

type ColloquioRow = {
  id: string;
  round: number;
  stato: StatoColloquio;
  scheduledAt: string;
  modalita: ModalitaColloquio;
  intervistatoreUserId: string | null;
  intervistatoreLabel: string;
  intervistatoreNome: string;
  notePreliminari: string;
  noteSvolgimento: string;
  esito: EsitoColloquio | null;
  valutazione: string;
  valutazioneStelle: number | null;
};

const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

function StelleDisplay({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${value} su 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < value ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

function StellePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <span className={labelCls}>Valutazione</span>
      <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label="Valutazione">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} stell${n === 1 ? "a" : "e"}`}
            onClick={() => onChange(value === n ? 0 : n)}
            className={`text-2xl leading-none transition ${
              n <= value ? "text-amber-500" : "text-slate-300 hover:text-amber-300"
            }`}
          >
            ★
          </button>
        ))}
        {value > 0 ? (
          <span className="ml-2 text-xs tabular-nums text-[var(--muted)]">{value}/5</span>
        ) : (
          <span className="ml-2 text-xs text-[var(--muted)]">opzionale</span>
        )}
      </div>
      <input type="hidden" name="valutazioneStelle" value={value > 0 ? String(value) : ""} />
    </div>
  );
}

const STATO_COLLOQUIO_COLORS: Record<StatoColloquio, string> = {
  PROGRAMMATO: "bg-amber-100 text-amber-900",
  SVOLTO: "bg-sky-100 text-sky-900",
  ESITATO: "bg-emerald-100 text-emerald-800",
  ANNULLATO: "bg-stone-200 text-stone-700",
};

function datetimeLocalValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Fase in cui tipicamente si inserisce ciascun tipo di nota colloquio. */
function faseNotaColloquio(tipo: "preliminari" | "svolgimento"): string {
  const fase =
    tipo === "preliminari"
      ? STATO_CANDIDATURA_LABELS.RICEVUTA
      : STATO_CANDIDATURA_LABELS.COLLOQUIO;
  return `Sezione: ${fase}`;
}

export function CandidaturaColloquiClient({
  statoCandidatura,
  colloqui,
  utenti,
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
  const [modificaProgramma, setModificaProgramma] = useState<ColloquioRow | null>(null);
  const [modificaValutazione, setModificaValutazione] = useState<ColloquioRow | null>(null);
  const [stelle, setStelle] = useState(0);
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
          {statoCandidatura === "RICEVUTA" || statoCandidatura === "IN_VALUTAZIONE"
            ? "Programma un colloquio dalla scheda candidatura."
            : "Nessun colloquio per questa candidatura."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              {canManage ? <col style={{ width: "12%" }} /> : null}
            </colgroup>
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Colloquio</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Modalità</th>
                <th className="px-3 py-2">Intervistatore</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Esito</th>
                <th className="px-3 py-2">Valutazione</th>
                {canManage ? <th className="px-3 py-2 text-right">Azioni</th> : null}
              </tr>
            </thead>
            <tbody>
              {colloqui.map((c) => {
                const aperto = c.stato === "PROGRAMMATO" || c.stato === "SVOLTO";
                const sezioneNote = "Colloquio";
                const hasNote =
                  Boolean(c.notePreliminari) || Boolean(c.noteSvolgimento);
                const colSpan = canManage ? 8 : 7;
                return (
                  <Fragment key={c.id}>
                    <tr
                      id={`colloquio-${c.id}`}
                      className={`scroll-mt-24 border-t border-[var(--line)] ${aperto ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">{sezioneNote}</td>
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
                      <td className="px-3 py-2">
                        <StelleDisplay value={c.valutazioneStelle} />
                      </td>
                      {canManage ? (
                        <td className="px-3 py-2 text-right">
                          {c.stato === "PROGRAMMATO" ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                disabled={pending}
                                className="text-xs font-semibold text-[var(--accent)] underline"
                                onClick={() => {
                                  setError(null);
                                  setModificaProgramma(c);
                                }}
                              >
                                Modifica
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                className="text-xs font-semibold text-[var(--accent)] underline"
                                onClick={() => {
                                  setError(null);
                                  setStelle(c.valutazioneStelle || 0);
                                  setModificaValutazione(c);
                                }}
                              >
                                Registra esito
                              </button>
                            </div>
                          ) : c.stato === "SVOLTO" || c.stato === "ESITATO" ? (
                            <button
                              type="button"
                              disabled={pending}
                              className="text-xs font-semibold text-[var(--accent)] underline"
                              onClick={() => {
                                setError(null);
                                setStelle(c.valutazioneStelle || 0);
                                setModificaValutazione(c);
                              }}
                            >
                              Modifica
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                    {hasNote ? (
                      <tr className={aperto ? "bg-amber-50" : ""}>
                        <td colSpan={colSpan} className="px-3 pb-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                                {faseNotaColloquio("preliminari")}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">
                                {c.notePreliminari || "—"}
                              </p>
                            </div>
                            <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                                {faseNotaColloquio("svolgimento")}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">
                                {c.noteSvolgimento || "—"}
                              </p>
                            </div>
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
        open={!!modificaProgramma}
        title="Modifica colloquio"
        onClose={() => !pending && setModificaProgramma(null)}
      >
        {modificaProgramma ? (
          <form
            key={modificaProgramma.id}
            className="grid gap-3 p-4 text-sm"
            action={(fd) =>
              run(fd, aggiornaColloquioAction, () => setModificaProgramma(null))
            }
          >
            <input type="hidden" name="id" value={modificaProgramma.id} />
            <label>
              <span className={labelCls}>Data e ora</span>
              <input
                type="datetime-local"
                name="scheduledAt"
                required
                defaultValue={datetimeLocalValue(modificaProgramma.scheduledAt)}
                className={inputCls}
              />
            </label>
            <label>
              <span className={labelCls}>Modalità</span>
              <select
                name="modalita"
                defaultValue={modificaProgramma.modalita}
                className={inputCls}
              >
                {MODALITA_COLLOQUIO.map((m) => (
                  <option key={m} value={m}>
                    {MODALITA_COLLOQUIO_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Intervistatore *</span>
              <select
                name="intervistatoreUserId"
                required
                defaultValue={modificaProgramma.intervistatoreUserId || ""}
                className={inputCls}
              >
                <option value="">Seleziona</option>
                {utenti.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>{faseNotaColloquio("preliminari")}</span>
              <textarea
                name="notePreliminari"
                maxLength={2000}
                rows={3}
                defaultValue={modificaProgramma.notePreliminari}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setModificaProgramma(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Salvataggio…" : "Salva"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={!!modificaValutazione}
        title="Modifica valutazione"
        onClose={() => !pending && setModificaValutazione(null)}
      >
        {modificaValutazione ? (
          <form
            key={modificaValutazione.id}
            className="grid gap-3 p-4 text-sm"
            action={(fd) =>
              run(fd, svolgiColloquioAction, () => setModificaValutazione(null))
            }
          >
            <input type="hidden" name="id" value={modificaValutazione.id} />
            <StellePicker value={stelle} onChange={setStelle} />
            <label>
              <span className={labelCls}>{faseNotaColloquio("preliminari")}</span>
              <textarea
                name="notePreliminari"
                maxLength={2000}
                rows={2}
                defaultValue={modificaValutazione.notePreliminari}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
            <label>
              <span className={labelCls}>{faseNotaColloquio("svolgimento")}</span>
              <textarea
                name="noteSvolgimento"
                maxLength={2000}
                rows={3}
                defaultValue={modificaValutazione.noteSvolgimento}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
            <label>
              <span className={labelCls}>Esito</span>
              <select
                name="esito"
                required
                defaultValue={modificaValutazione.esito || ""}
                className={inputCls}
              >
                <option value="">Seleziona</option>
                {ESITI_COLLOQUIO.map((e) => (
                  <option key={e} value={e}>
                    {ESITO_COLLOQUIO_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setModificaValutazione(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Salvataggio…" : "Salva"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}
