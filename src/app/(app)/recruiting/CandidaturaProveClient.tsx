"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { aggiornaProvaAction, salvaEsitoProvaAction } from "@/actions/recruiting";
import {
  ESITI_PROVA,
  ESITO_PROVA_LABELS,
  type EsitoProva,
} from "@/lib/recruiting/attivita";
import {
  MODALITA_COLLOQUIO,
  MODALITA_COLLOQUIO_LABELS,
  type ModalitaColloquio,
} from "@/lib/recruiting/colloqui";
import type { StatoCandidatura } from "@/lib/recruiting/candidature";
import { STATO_CANDIDATURA_LABELS } from "@/lib/recruiting/candidature";

type ProvaClientRow = {
  id: string;
  scheduledAt: string;
  modalita: ModalitaColloquio;
  affiancatore: string;
  affiancatoreUserId: string | null;
  notePreliminari: string;
  esito: EsitoProva | null;
  parere: string;
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
            onClick={() => onChange(n)}
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
          <span className="ml-2 text-xs text-[var(--muted)]">obbligatoria</span>
        )}
      </div>
      <input type="hidden" name="valutazioneStelle" value={value > 0 ? String(value) : ""} />
    </div>
  );
}

function datetimeLocalValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function faseNotaProva(tipo: "preliminari" | "svolgimento"): string {
  const fase =
    tipo === "preliminari"
      ? STATO_CANDIDATURA_LABELS.COLLOQUIO
      : STATO_CANDIDATURA_LABELS.PROVA;
  return `Sezione: ${fase}`;
}

export function CandidaturaProveClient({
  candidaturaId,
  statoCandidatura,
  prove,
  utenti,
  canManage,
}: {
  candidaturaId: string;
  statoCandidatura: StatoCandidatura;
  prove: ProvaClientRow[];
  utenti: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [modificaProgramma, setModificaProgramma] = useState<ProvaClientRow | null>(null);
  const [modificaValutazione, setModificaValutazione] = useState<ProvaClientRow | null>(null);
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
        <h2 className="text-sm font-semibold text-[var(--navy)]">Prove</h2>
      </div>
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {prove.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
          {statoCandidatura === "COLLOQUIO"
            ? "Programma una prova dalla scheda candidatura."
            : "Nessuna prova per questa candidatura."}
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
                <th className="px-3 py-2">In prova</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Modalità</th>
                <th className="px-3 py-2">Affiancatore</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Esito</th>
                <th className="px-3 py-2">Valutazione</th>
                {canManage ? <th className="px-3 py-2 text-right">Azioni</th> : null}
              </tr>
            </thead>
            <tbody>
              {prove.map((p) => {
                const hasEsito = Boolean(p.esito);
                const aperto = !hasEsito;
                const hasNote = Boolean(p.notePreliminari) || Boolean(p.parere);
                const colSpan = canManage ? 8 : 7;
                return (
                  <Fragment key={p.id}>
                    <tr
                      id={`prova-${p.id}`}
                      className={`scroll-mt-24 border-t border-[var(--line)] ${
                        aperto ? "bg-amber-50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-medium">
                        {STATO_CANDIDATURA_LABELS.PROVA}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {new Date(p.scheduledAt).toLocaleString("it-IT")}
                      </td>
                      <td className="px-3 py-2">{MODALITA_COLLOQUIO_LABELS[p.modalita]}</td>
                      <td className="px-3 py-2">{p.affiancatore}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            hasEsito
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {hasEsito ? "Esitata" : "Programmata"}
                          {aperto ? " · aperto" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {p.esito ? ESITO_PROVA_LABELS[p.esito] : ""}
                      </td>
                      <td className="px-3 py-2">
                        <StelleDisplay value={p.valutazioneStelle} />
                      </td>
                      {canManage ? (
                        <td className="px-3 py-2 text-right">
                          {statoCandidatura === "PROVA" ? (
                            !hasEsito ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={pending}
                                  className="text-xs font-semibold text-[var(--accent)] underline"
                                  onClick={() => {
                                    setError(null);
                                    setModificaProgramma(p);
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
                                    setStelle(p.valutazioneStelle || 0);
                                    setModificaValutazione(p);
                                  }}
                                >
                                  Registra esito
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={pending}
                                className="text-xs font-semibold text-[var(--accent)] underline"
                                onClick={() => {
                                  setError(null);
                                  setStelle(p.valutazioneStelle || 0);
                                  setModificaValutazione(p);
                                }}
                              >
                                Modifica
                              </button>
                            )
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
                                {faseNotaProva("preliminari")}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">
                                {p.notePreliminari || "—"}
                              </p>
                            </div>
                            <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                                {faseNotaProva("svolgimento")}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--navy)]">
                                {p.parere || "—"}
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
        title="Modifica prova"
        onClose={() => !pending && setModificaProgramma(null)}
      >
        {modificaProgramma ? (
          <form
            key={modificaProgramma.id}
            className="grid gap-3 p-4 text-sm"
            action={(fd) =>
              run(fd, aggiornaProvaAction, () => setModificaProgramma(null))
            }
          >
            <input type="hidden" name="provaId" value={modificaProgramma.id} />
            <input type="hidden" name="candidaturaId" value={candidaturaId} />
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
              <span className={labelCls}>Affiancatore *</span>
              <select
                name="affiancatoreUserId"
                required
                defaultValue={modificaProgramma.affiancatoreUserId || ""}
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
              <span className={labelCls}>{faseNotaProva("preliminari")}</span>
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
              run(fd, salvaEsitoProvaAction, () => setModificaValutazione(null))
            }
          >
            <input type="hidden" name="provaId" value={modificaValutazione.id} />
            <StellePicker value={stelle} onChange={setStelle} />
            <label>
              <span className={labelCls}>{faseNotaProva("svolgimento")}</span>
              <textarea
                name="parere"
                maxLength={2000}
                rows={3}
                required
                defaultValue={modificaValutazione.parere}
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
                {ESITI_PROVA.map((e) => (
                  <option key={e} value={e}>
                    {ESITO_PROVA_LABELS[e]}
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
                disabled={pending || stelle < 1}
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
