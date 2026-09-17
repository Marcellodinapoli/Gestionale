"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Plus, UserRound } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  aggiornaOffertaLavoroAction,
  chiudiOffertaLavoroAction,
  creaOffertaLavoroAction,
} from "@/actions/recruiting";
import {
  DICITURA_PARI_OPPORTUNITA,
  MODALITA_LAVORO,
  MODALITA_LAVORO_LABELS,
  ORARI_LAVORO,
  ORARIO_LAVORO_LABELS,
  STATO_OFFERTA_LAVORO_LABELS,
  TIPI_CONTRATTO,
  TIPO_CONTRATTO_LABELS,
  type ModalitaLavoro,
  type OrarioLavoro,
  type StatoOffertaLavoro,
  type TipoContratto,
} from "@/lib/recruiting/offerte";
import {
  STATO_CANDIDATURA_LABELS,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";
import {
  STATO_COLLOQUIO_LABELS,
  type StatoColloquio,
} from "@/lib/recruiting/colloqui";

type OffertaRow = {
  id: string;
  titolo: string;
  luogo: string;
  modalitaLavoro: ModalitaLavoro;
  tipoContratto: TipoContratto | "";
  orario: OrarioLavoro | "";
  numeroPosizioni: number;
  descrizione: string;
  attivitaPrincipali: string;
  requisiti: string;
  competenze: string;
  retribuzione: string;
  benefit: string;
  stato: StatoOffertaLavoro;
  updatedAt: string;
  candidatureCount: number;
};

type CandidaturaHome = {
  id: string;
  offertaId: string;
  stato: StatoCandidatura;
  source: string | null;
  receivedAt: string;
};

type ColloquioHome = {
  id: string;
  candidaturaId: string;
  round: number;
  stato: StatoColloquio;
  scheduledAt: string;
};

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

const STATO_COLORS: Record<StatoOffertaLavoro, string> = {
  BOZZA: "bg-slate-100 text-slate-700",
  PUBBLICATA: "bg-emerald-100 text-emerald-800",
  CHIUSA: "bg-stone-200 text-stone-700",
};

const STATO_CAND_COLORS: Record<StatoCandidatura, string> = {
  RICEVUTA: "bg-slate-100 text-slate-700",
  IN_VALUTAZIONE: "bg-amber-100 text-amber-900",
  COLLOQUIO: "bg-sky-100 text-sky-800",
  PROVA: "bg-teal-100 text-teal-900",
  ASSUNTA: "bg-emerald-100 text-emerald-800",
  ARCHIVIATA: "bg-stone-200 text-stone-800",
};

const STATO_COLL_COLORS: Record<StatoColloquio, string> = {
  PROGRAMMATO: "bg-amber-100 text-amber-900",
  SVOLTO: "bg-sky-100 text-sky-900",
  ESITATO: "bg-emerald-100 text-emerald-800",
  ANNULLATO: "bg-stone-200 text-stone-700",
};

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT");
}

function progressivi(rows: CandidaturaHome[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a.receivedAt).getTime();
    const db = new Date(b.receivedAt).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
  return new Map(sorted.map((row, i) => [row.id, i + 1]));
}

function MockBadge() {
  return (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-800">
      MOCK
    </span>
  );
}

export function OfferteLavoroClient({
  offerte,
  canManage,
  candidature = [],
  colloqui = [],
}: {
  offerte: OffertaRow[];
  canManage: boolean;
  candidature?: CandidaturaHome[];
  colloqui?: ColloquioHome[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<OffertaRow | null>(null);
  const [chiudi, setChiudi] = useState<OffertaRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onOk?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operazione non riuscita");
      }
    });
  }

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nuova offerta
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {offerte.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Nessuna offerta di lavoro.
        </p>
      ) : (
        <div className="space-y-3">
          {offerte.map((o) => {
            const cands = candidature.filter((c) => c.offertaId === o.id);
            const ranks = progressivi(cands);
            const ordered = [...cands].sort((a, b) => {
              const db = new Date(b.receivedAt).getTime();
              const da = new Date(a.receivedAt).getTime();
              if (db !== da) return db - da;
              return b.id.localeCompare(a.id);
            });
            return (
              <article
                key={o.id}
                className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm"
              >
                <div
                  className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-[var(--navy)] bg-[var(--navy)]/5 px-4 py-3 hover:bg-[var(--navy)]/10"
                  onClick={() => router.push(`/recruiting/offerte/${o.id}`)}
                >
                  <div className="min-w-[14rem] flex-1">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--navy)]">
                      <Briefcase className="h-3.5 w-3.5" />
                      Inserzione
                    </p>
                    <Link
                      href={`/recruiting/offerte/${o.id}`}
                      className="text-base font-semibold text-[var(--navy)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {o.titolo}
                    </Link>
                  </div>
                  <div className="min-w-[6rem] text-sm">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Sede
                    </p>
                    <p>{o.luogo || "—"}</p>
                  </div>
                  <div className="min-w-[6rem] text-sm">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Modalità
                    </p>
                    <p>{MODALITA_LAVORO_LABELS[o.modalitaLavoro]}</p>
                  </div>
                  <div className="min-w-[5rem]">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Stato
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATO_COLORS[o.stato]}`}
                    >
                      {STATO_OFFERTA_LAVORO_LABELS[o.stato]}
                    </span>
                  </div>
                  <div className="min-w-[6rem] text-sm">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Candidature
                    </p>
                    <p className="tabular-nums font-semibold text-[var(--navy)]">
                      {o.candidatureCount}
                    </p>
                  </div>
                  <div className="min-w-[6rem] text-sm text-[var(--muted)]">
                    <p className="text-[10px] font-semibold uppercase">Aggiornata</p>
                    <p className="tabular-nums">{formatData(o.updatedAt)}</p>
                  </div>
                  {canManage && o.stato !== "CHIUSA" ? (
                    <div
                      className="ml-auto flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setEdit(o);
                        }}
                        className="text-xs font-semibold text-[var(--accent)] underline"
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setChiudi(o);
                        }}
                        className="text-xs font-semibold text-rose-700 underline"
                      >
                        Chiudi offerta
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-[var(--line)] bg-slate-50 px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                    <UserRound className="h-3.5 w-3.5" />
                    Candidature
                  </p>
                  {ordered.length === 0 ? (
                    <p className="ml-6 text-sm text-[var(--muted)]">
                      Nessuna candidatura.
                    </p>
                  ) : (
                    <ul className="ml-2 space-y-1.5 border-l-2 border-slate-300 pl-4">
                      {ordered.map((c) => {
                        const n = ranks.get(c.id) ?? 0;
                        const ricevutaGiorno = new Date(c.receivedAt).toLocaleDateString(
                          "it-IT"
                        );
                        const mock = c.source === "mock" || c.source === "percorso";
                        const coll = colloqui
                          .filter((x) => x.candidaturaId === c.id)
                          .sort(
                            (a, b) =>
                              new Date(b.scheduledAt).getTime() -
                              new Date(a.scheduledAt).getTime()
                          );
                        return (
                          <li
                            key={c.id}
                            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <Link
                                href={`/recruiting/offerte/${o.id}/${c.id}`}
                                className="font-medium text-slate-700 hover:underline"
                              >
                                Candidatura {n} · {ricevutaGiorno}
                              </Link>
                              {mock ? <MockBadge /> : null}
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATO_CAND_COLORS[c.stato]}`}
                              >
                                {STATO_CANDIDATURA_LABELS[c.stato]}
                              </span>
                              <span className="text-[var(--muted)]">
                                {c.source || "—"}
                              </span>
                              <span className="tabular-nums text-[var(--muted)]">
                                {new Date(c.receivedAt).toLocaleString("it-IT")}
                              </span>
                            </div>
                            {coll.length > 0 ? (
                              <ul className="mt-1.5 ml-3 space-y-1 border-l border-slate-200 pl-3">
                                {coll.map((col) => (
                                  <li
                                    key={col.id}
                                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]"
                                  >
                                    <Link
                                      href={`/recruiting/offerte/${o.id}/${c.id}#colloquio-${col.id}`}
                                      className="font-medium hover:underline"
                                    >
                                      {col.round}° colloquio
                                    </Link>
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${STATO_COLL_COLORS[col.stato]}`}
                                    >
                                      {STATO_COLLOQUIO_LABELS[col.stato]}
                                    </span>
                                    <span className="tabular-nums">
                                      {new Date(col.scheduledAt).toLocaleString("it-IT")}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Nuova offerta"
        wide
        onClose={() => !pending && setCreateOpen(false)}
      >
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) =>
            run(
              () => creaOffertaLavoroAction(fd),
              () => setCreateOpen(false)
            )
          }
        >
          <OffertaFields />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Salvataggio…" : "Crea"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(edit)}
        title="Modifica offerta"
        wide
        onClose={() => !pending && setEdit(null)}
      >
        {edit ? (
          <form
            className="grid gap-3 p-4 text-sm"
            action={(fd) =>
              run(
                () => aggiornaOffertaLavoroAction(fd),
                () => setEdit(null)
              )
            }
          >
            <input type="hidden" name="id" value={edit.id} />
            <OffertaFields offerta={edit} allowBozza={edit.stato !== "PUBBLICATA"} />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setEdit(null)}
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
        open={Boolean(chiudi)}
        title="Chiudi offerta"
        onClose={() => !pending && setChiudi(null)}
      >
        {chiudi ? (
          <div className="grid gap-3 p-4 text-sm">
            <p>
              Dopo la chiusura non sarà possibile creare nuove candidature su questa
              offerta. Confermi?
            </p>
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
                type="button"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", chiudi.id);
                  run(() => chiudiOffertaLavoroAction(fd), () => setChiudi(null));
                }}
                className="h-9 rounded-lg bg-rose-800 px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Salvataggio…" : "Chiudi offerta"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function OffertaFields({
  offerta,
  allowBozza = true,
}: {
  offerta?: OffertaRow | null;
  allowBozza?: boolean;
}) {
  const defaultStato = offerta?.stato === "PUBBLICATA" ? "PUBBLICATA" : "BOZZA";
  return (
    <>
      <p className="text-xs text-[var(--muted)]">
        Campi allineati alla scheda offerta Indeed (titolo, sede, modalità, contratto,
        descrizione, retribuzione, benefit). La pubblicazione su Indeed non è attiva.
      </p>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Posizione
        </legend>
        <label>
          <span className={labelCls}>Titolo *</span>
          <input
            name="titolo"
            required
            maxLength={200}
            defaultValue={offerta?.titolo || ""}
            className={inputCls}
            placeholder="es. Operatore call center"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Modalità di lavoro *</span>
            <select
              name="modalitaLavoro"
              required
              defaultValue={offerta?.modalitaLavoro || "PRESENZA"}
              className={inputCls}
            >
              {MODALITA_LAVORO.map((m) => (
                <option key={m} value={m}>
                  {MODALITA_LAVORO_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Sede *</span>
            <input
              name="luogo"
              required
              maxLength={200}
              defaultValue={offerta?.luogo || ""}
              className={inputCls}
              placeholder="es. Napoli"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Contratto
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={labelCls}>Tipo contratto</span>
            <select
              name="tipoContratto"
              defaultValue={offerta?.tipoContratto || ""}
              className={inputCls}
            >
              <option value="">—</option>
              {TIPI_CONTRATTO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_CONTRATTO_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Orario</span>
            <select name="orario" defaultValue={offerta?.orario || ""} className={inputCls}>
              <option value="">—</option>
              {ORARI_LAVORO.map((o) => (
                <option key={o} value={o}>
                  {ORARIO_LAVORO_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Numero posizioni</span>
            <input
              name="numeroPosizioni"
              type="number"
              min={1}
              max={999}
              defaultValue={offerta?.numeroPosizioni || 1}
              className={inputCls}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Descrizione
        </legend>
        <label>
          <span className={labelCls}>Descrizione *</span>
          <textarea
            name="descrizione"
            required
            maxLength={20000}
            rows={5}
            defaultValue={offerta?.descrizione || ""}
            className={`${inputCls} h-auto py-2`}
            placeholder="Descrizione del ruolo (minimo 30 caratteri per pubblicare)"
          />
        </label>
        <label>
          <span className={labelCls}>Attività principali</span>
          <textarea
            name="attivitaPrincipali"
            maxLength={20000}
            rows={3}
            defaultValue={offerta?.attivitaPrincipali || ""}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
        <label>
          <span className={labelCls}>Requisiti</span>
          <textarea
            name="requisiti"
            maxLength={20000}
            rows={3}
            defaultValue={offerta?.requisiti || ""}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
        <label>
          <span className={labelCls}>Competenze / esperienza</span>
          <textarea
            name="competenze"
            maxLength={20000}
            rows={3}
            defaultValue={offerta?.competenze || ""}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Condizioni
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Retribuzione</span>
            <input
              name="retribuzione"
              maxLength={500}
              defaultValue={offerta?.retribuzione || ""}
              className={inputCls}
              placeholder="es. 1.400–1.600 € mese"
            />
          </label>
          <label>
            <span className={labelCls}>Benefit</span>
            <textarea
              name="benefit"
              maxLength={20000}
              rows={2}
              defaultValue={offerta?.benefit || ""}
              className={`${inputCls} h-auto py-2`}
              placeholder="Un benefit per riga"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Pubblicazione
        </legend>
        <label>
          <span className={labelCls}>Stato</span>
          <select name="stato" defaultValue={defaultStato} className={inputCls}>
            {allowBozza ? <option value="BOZZA">Bozza</option> : null}
            <option value="PUBBLICATA">Pubblicata</option>
          </select>
        </label>
        <p className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 text-sm text-[var(--navy)]">
          {DICITURA_PARI_OPPORTUNITA}
        </p>
      </fieldset>
    </>
  );
}
