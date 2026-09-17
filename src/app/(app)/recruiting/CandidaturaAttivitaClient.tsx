"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  aggiungiNotaCandidaturaAction,
  registraContattoCandidaturaAction,
} from "@/actions/recruiting";
import {
  CANALE_CONTATTO_LABELS,
  CANALI_CONTATTO,
  ESITI_CONTATTO,
  ESITO_CONTATTO_LABELS,
  type CanaleContatto,
  type EsitoContatto,
} from "@/lib/recruiting/attivita";

const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

function datetimeLocalNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type VoceContattoNota = {
  id: string;
  tipo: "CONTATTO" | "NOTA";
  occurredAt: string;
  note: string;
  esito: string | null;
  canale: CanaleContatto | null;
  createdByName: string;
};

export function CandidaturaAttivitaClient({
  candidaturaId,
  canManage,
  voci,
}: {
  candidaturaId: string;
  canManage: boolean;
  voci: VoceContattoNota[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"contatto" | "nota" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const elenco = [...voci].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  function run(fd: FormData, action: (data: FormData) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(fd);
        setMode(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operazione non riuscita");
      }
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Contatti e note</h2>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("contatto");
            }}
            className="h-9 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold"
          >
            Registra contatto
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("nota");
            }}
            className="h-9 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold"
          >
            Aggiungi nota
          </button>
        </div>
      ) : null}
      {elenco.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
          Nessun contatto o nota.
        </p>
      ) : (
        <ul className="space-y-2 rounded-xl border border-[var(--line)] bg-white p-4">
          {elenco.map((v) => {
            const extra =
              v.tipo === "CONTATTO"
                ? [
                    v.canale ? CANALE_CONTATTO_LABELS[v.canale] : null,
                    v.esito && v.esito in ESITO_CONTATTO_LABELS
                      ? ESITO_CONTATTO_LABELS[v.esito as EsitoContatto]
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "";
            return (
              <li
                key={v.id}
                className="border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"
              >
                <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  {v.tipo === "NOTA" ? "Nota" : "Contatto"}
                </p>
                {v.note.trim() ? <p className="text-sm">{v.note.trim()}</p> : null}
                <p className="text-xs text-[var(--muted)]">
                  {new Date(v.occurredAt).toLocaleString("it-IT")} · {v.createdByName}
                  {extra ? ` · ${extra}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <Modal
        open={mode === "contatto"}
        title="Registra contatto"
        onClose={() => !pending && setMode(null)}
      >
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) => run(fd, registraContattoCandidaturaAction)}
        >
          <input type="hidden" name="candidaturaId" value={candidaturaId} />
          <p className="text-xs text-[var(--muted)]">
            Nessun numero, email o recapito. Solo canale, esito e nota operativa.
          </p>
          <label>
            <span className={labelCls}>Canale</span>
            <select name="canale" defaultValue="TELEFONO" className={inputCls}>
              {CANALI_CONTATTO.map((c) => (
                <option key={c} value={c}>
                  {CANALE_CONTATTO_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Esito</span>
            <select name="esito" defaultValue="RAGGIUNTO" className={inputCls}>
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
              defaultValue={datetimeLocalNow()}
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
              onClick={() => setMode(null)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Salvataggio…" : "Registra"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={mode === "nota"} title="Aggiungi nota" onClose={() => !pending && setMode(null)}>
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) => run(fd, aggiungiNotaCandidaturaAction)}
        >
          <input type="hidden" name="candidaturaId" value={candidaturaId} />
          <label>
            <span className={labelCls}>Data e ora</span>
            <input
              type="datetime-local"
              name="occurredAt"
              defaultValue={datetimeLocalNow()}
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
              onClick={() => setMode(null)}
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
    </section>
  );
}
