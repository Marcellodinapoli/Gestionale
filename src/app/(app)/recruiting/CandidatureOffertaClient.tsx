"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { creaCandidaturaAction } from "@/actions/recruiting";
import {
  STATO_CANDIDATURA_LABELS,
  anagraficaCandidato,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";

type CandidaturaRow = {
  id: string;
  stato: StatoCandidatura;
  source: string | null;
  receivedAt: string;
  cognome: string;
  nome: string;
};

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

const STATO_COLORS: Record<StatoCandidatura, string> = {
  RICEVUTA: "bg-slate-100 text-slate-700",
  IN_VALUTAZIONE: "bg-amber-100 text-amber-900",
  COLLOQUIO: "bg-sky-100 text-sky-800",
  PROVA: "bg-teal-100 text-teal-900",
  ASSUNTA: "bg-emerald-100 text-emerald-800",
  ARCHIVIATA: "bg-stone-200 text-stone-800",
};

function progressivi(rows: CandidaturaRow[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a.receivedAt).getTime();
    const db = new Date(b.receivedAt).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
  return new Map(sorted.map((row, i) => [row.id, i + 1]));
}

export function CandidatureOffertaClient({
  offertaId,
  candidature,
  filtroStato = null,
  mostraElenco = true,
  canManage,
  offertaChiusa,
}: {
  offertaId: string;
  candidature: CandidaturaRow[];
  filtroStato?: StatoCandidatura | null;
  mostraElenco?: boolean;
  canManage: boolean;
  offertaChiusa: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ranks = useMemo(() => progressivi(candidature), [candidature]);
  const visibili = filtroStato
    ? candidature.filter((c) => c.stato === filtroStato)
    : candidature;

  return (
    <div className="space-y-3">
      {canManage && !offertaChiusa ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Nuova candidatura
          </button>
        </div>
      ) : null}

      {canManage && offertaChiusa ? (
        <p className="text-sm text-[var(--muted)]">
          Offerta chiusa: non si possono creare nuove candidature.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {mostraElenco && visibili.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          {filtroStato
            ? `Nessuna candidatura in «${STATO_CANDIDATURA_LABELS[filtroStato]}».`
            : "Nessuna candidatura per questa offerta."}
        </p>
      ) : mostraElenco ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Candidatura</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Origine</th>
                <th className="px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {visibili.map((c) => {
                const n = ranks.get(c.id) ?? 0;
                const ricevutaGiorno = new Date(c.receivedAt).toLocaleDateString("it-IT");
                const ricevuta = new Date(c.receivedAt).toLocaleString("it-IT");
                const candidato = anagraficaCandidato(c);
                return (
                  <tr key={c.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2">
                      <Link
                        href={`/recruiting/offerte/${offertaId}/${c.id}`}
                        className="font-semibold text-[var(--navy)] hover:underline"
                      >
                        {candidato.label}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        Candidatura {n} · {ricevutaGiorno}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATO_COLORS[c.stato]}`}
                      >
                        {STATO_CANDIDATURA_LABELS[c.stato]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">{c.source || "—"}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-[var(--navy)]">
                      {ricevuta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal
        open={open}
        title="Nuova candidatura"
        onClose={() => !pending && setOpen(false)}
      >
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              try {
                await creaCandidaturaAction(fd);
                setOpen(false);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Operazione non riuscita");
              }
            });
          }}
        >
          <input type="hidden" name="offertaId" value={offertaId} />
          <p className="text-xs text-[var(--muted)]">
            Lo stato iniziale è Candidatura. Cognome e nome sono obbligatori.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelCls}>Cognome</span>
              <input name="cognome" required maxLength={80} className={inputCls} />
            </label>
            <label>
              <span className={labelCls}>Nome</span>
              <input name="nome" required maxLength={80} className={inputCls} />
            </label>
          </div>
          <label>
            <span className={labelCls}>Origine (opzionale)</span>
            <input name="source" maxLength={80} className={inputCls} placeholder="es. manuale" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
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
    </div>
  );
}
