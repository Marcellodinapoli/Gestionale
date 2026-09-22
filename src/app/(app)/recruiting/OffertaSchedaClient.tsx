"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  aggiornaOffertaLavoroAction,
  chiudiOffertaLavoroAction,
  eliminaOffertaLavoroAction,
} from "@/actions/recruiting";
import {
  DICITURA_PARI_OPPORTUNITA,
  MODALITA_LAVORO,
  MODALITA_LAVORO_LABELS,
  ORARI_LAVORO,
  ORARIO_LAVORO_LABELS,
  TIPI_CONTRATTO,
  TIPO_CONTRATTO_LABELS,
  type ModalitaLavoro,
  type OrarioLavoro,
  type StatoOffertaLavoro,
  type TipoContratto,
} from "@/lib/recruiting/offerte";

export type OffertaSchedaRow = {
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
};

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

export function OffertaSchedaClient({
  offerta,
  canManage,
  canDelete,
}: {
  offerta: OffertaSchedaRow;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [chiudiOpen, setChiudiOpen] = useState(false);
  const [eliminaOpen, setEliminaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canManage) return null;

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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setEditOpen(true);
          }}
          className="text-sm font-semibold text-[var(--accent)] underline"
        >
          Modifica offerta
        </button>
        {offerta.stato !== "CHIUSA" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setChiudiOpen(true);
            }}
            className="text-sm font-semibold text-rose-700 underline"
          >
            Chiudi offerta
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setEliminaOpen(true);
            }}
            className="text-sm font-semibold text-rose-800 underline"
          >
            Elimina offerta
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <Modal
        open={editOpen}
        title="Modifica offerta"
        wide
        onClose={() => !pending && setEditOpen(false)}
      >
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) =>
            run(
              () => aggiornaOffertaLavoroAction(fd),
              () => setEditOpen(false)
            )
          }
        >
          <input type="hidden" name="id" value={offerta.id} />
          {offerta.stato === "CHIUSA" ? (
            <input type="hidden" name="stato" value="CHIUSA" />
          ) : null}
          <SchedaFields offerta={offerta} lockedStato={offerta.stato === "CHIUSA"} />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditOpen(false)}
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
      </Modal>

      <Modal
        open={chiudiOpen}
        title="Chiudi offerta"
        onClose={() => !pending && setChiudiOpen(false)}
      >
        <div className="grid gap-3 p-4 text-sm">
          <p>
            Dopo la chiusura non sarà possibile creare nuove candidature su questa
            offerta. Confermi?
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setChiudiOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", offerta.id);
                run(() => chiudiOffertaLavoroAction(fd), () => setChiudiOpen(false));
              }}
              className="h-9 rounded-lg bg-rose-800 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Salvataggio…" : "Chiudi offerta"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={eliminaOpen}
        title="Elimina offerta"
        onClose={() => !pending && setEliminaOpen(false)}
      >
        <div className="grid gap-3 p-4 text-sm">
          <p>
            L&apos;offerta verrà eliminata definitivamente. Possibile solo se non ci
            sono candidature o attività collegate.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEliminaOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", offerta.id);
                run(async () => {
                  await eliminaOffertaLavoroAction(fd);
                  router.push("/recruiting");
                });
              }}
              className="h-9 rounded-lg bg-rose-800 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Eliminazione…" : "Elimina"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SchedaFields({
  offerta,
  lockedStato,
}: {
  offerta: OffertaSchedaRow;
  lockedStato: boolean;
}) {
  const defaultStato = offerta.stato === "PUBBLICATA" ? "PUBBLICATA" : "BOZZA";
  return (
    <>
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
            defaultValue={offerta.titolo}
            className={inputCls}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Sede *</span>
            <input
              name="luogo"
              required
              maxLength={200}
              defaultValue={offerta.luogo}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Modalità *</span>
            <select
              name="modalitaLavoro"
              required
              defaultValue={offerta.modalitaLavoro}
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
            <span className={labelCls}>Contratto</span>
            <select
              name="tipoContratto"
              defaultValue={offerta.tipoContratto || ""}
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
            <select name="orario" defaultValue={offerta.orario || ""} className={inputCls}>
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
              defaultValue={offerta.numeroPosizioni}
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
            defaultValue={offerta.descrizione}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
        <label>
          <span className={labelCls}>Attività principali</span>
          <textarea
            name="attivitaPrincipali"
            maxLength={20000}
            rows={3}
            defaultValue={offerta.attivitaPrincipali}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
        <label>
          <span className={labelCls}>Requisiti</span>
          <textarea
            name="requisiti"
            maxLength={20000}
            rows={3}
            defaultValue={offerta.requisiti}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
        <label>
          <span className={labelCls}>Competenze / esperienza</span>
          <textarea
            name="competenze"
            maxLength={20000}
            rows={3}
            defaultValue={offerta.competenze}
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
              defaultValue={offerta.retribuzione}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Benefit</span>
            <textarea
              name="benefit"
              maxLength={20000}
              rows={2}
              defaultValue={offerta.benefit}
              className={`${inputCls} h-auto py-2`}
            />
          </label>
        </div>
      </fieldset>

      {!lockedStato ? (
        <fieldset className="grid gap-3">
          <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
            Pubblicazione
          </legend>
          <label>
            <span className={labelCls}>Stato</span>
            <select name="stato" defaultValue={defaultStato} className={inputCls}>
              {offerta.stato !== "PUBBLICATA" ? (
                <option value="BOZZA">Bozza</option>
              ) : null}
              <option value="PUBBLICATA">Pubblicata</option>
            </select>
          </label>
          <p className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 text-sm text-[var(--navy)]">
            {DICITURA_PARI_OPPORTUNITA}
          </p>
        </fieldset>
      ) : (
        <p className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 text-sm text-[var(--muted)]">
          Offerta chiusa: puoi aggiornare i testi, lo stato resta Chiusa.
        </p>
      )}
    </>
  );
}
