"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  eliminaImportBatchChunkAction,
  eliminaImportBatchFinalizeAction,
  eliminaImportBatchPrepareAction,
} from "@/actions/importBatch";
import {
  importBatchBloccato,
  motivoBloccoImportBatch,
  type ImportBatchListItem,
} from "@/lib/importBatch";

const ELIMINA_IMPORT_CHUNK = 5;

function formatQuando(iso: string) {
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ImportBatchList({ items }: { items: ImportBatchListItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  function integra(item: ImportBatchListItem) {
    const sp = new URLSearchParams();
    sp.set("integra", item.id);
    router.push(`/import?${sp.toString()}#import-pratiche`);
  }

  async function elimina(item: ImportBatchListItem) {
    if (importBatchBloccato(item)) {
      setMessage(
        motivoBloccoImportBatch(item.blocchi) ??
          "Non eliminabile: almeno una pratica ha note, cambio codice o incassi"
      );
      return;
    }
    const ok = window.confirm(
      `Eliminare l'import del ${formatQuando(item.createdAt)}?\n` +
        `Lotto ${item.lotto} · ${item.nPratiche} pratiche · ${item.mandanteCodice}\n` +
        `L'operazione non è reversibile.`
    );
    if (!ok) return;

    setBusyId(item.id);
    setMessage(null);
    setProgress(0);
    setProgressLabel("Verifica in corso…");
    try {
      const prepareFd = new FormData();
      prepareFd.set("batchId", item.id);
      const prepared = await eliminaImportBatchPrepareAction(prepareFd);
      if ("error" in prepared) {
        setMessage(prepared.error ?? "Eliminazione non riuscita");
        return;
      }

      const { batchId, praticaIds, debitoreIds, total } = prepared;
      let deleted = 0;

      for (let i = 0; i < praticaIds.length; i += ELIMINA_IMPORT_CHUNK) {
        const chunk = praticaIds.slice(i, i + ELIMINA_IMPORT_CHUNK);
        setProgress(total > 0 ? Math.round((deleted / total) * 100) : 5);
        setProgressLabel(
          total > 0
            ? `Eliminazione pratiche ${deleted + 1}–${Math.min(deleted + chunk.length, total)} di ${total}…`
            : "Eliminazione in corso…"
        );

        const chunkFd = new FormData();
        chunkFd.set("batchId", batchId);
        chunkFd.set("praticaIds", JSON.stringify(chunk));
        const chunkRes = await eliminaImportBatchChunkAction(chunkFd);
        if ("error" in chunkRes) {
          setMessage(chunkRes.error ?? "Eliminazione non riuscita");
          return;
        }

        deleted += chunkRes.deleted;
        setProgress(total > 0 ? Math.round((deleted / total) * 100) : 100);
        setProgressLabel(
          total > 0
            ? `Eliminate ${deleted}/${total} pratiche…`
            : "Eliminazione in corso…"
        );
      }

      setProgressLabel("Conclusione eliminazione…");
      setProgress(total > 0 ? 98 : 100);

      const finalizeFd = new FormData();
      finalizeFd.set("batchId", batchId);
      finalizeFd.set("debitoreIds", JSON.stringify(debitoreIds));
      finalizeFd.set("nPratiche", String(total));
      const finalized = await eliminaImportBatchFinalizeAction(finalizeFd);
      if ("error" in finalized) {
        setMessage(finalized.error ?? "Eliminazione non riuscita");
        return;
      }

      setProgress(100);
      setProgressLabel("Completato");
      if (finalized.ok) {
        setMessage(finalized.ok);
        router.refresh();
      }
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Eliminazione non riuscita");
    } finally {
      setBusyId(null);
      setProgress(0);
      setProgressLabel(null);
    }
  }

  if (!items.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Nessun import pratiche ancora registrato.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {busyId && (progress > 0 || progressLabel) ? (
        <div
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-3 shadow-sm"
          aria-live="polite"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[var(--navy)]">
            <span>{progressLabel ?? "Eliminazione in corso…"}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#dce4ec]">
            <div
              className="h-full rounded-full bg-[var(--navy)] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.startsWith("Eliminato")
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              <th className="px-2 py-2">Data</th>
              <th className="px-2 py-2">Mandante</th>
              <th className="px-2 py-2">Perimetro</th>
              <th className="px-2 py-2">Lotto</th>
              <th className="px-2 py-2">Affido</th>
              <th className="px-2 py-2">Scadenza</th>
              <th className="px-2 py-2 text-right">Pratiche</th>
              <th className="px-2 py-2">File</th>
              <th className="px-2 py-2">Utente</th>
              <th className="px-2 py-2 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const blocco = motivoBloccoImportBatch(item.blocchi);
              return (
              <tr
                key={item.id}
                className="border-b border-[var(--line)]/70 align-middle"
              >
                <td className="px-2 py-2 whitespace-nowrap">
                  {formatQuando(item.createdAt)}
                </td>
                <td className="px-2 py-2 font-medium">{item.mandanteCodice}</td>
                <td className="px-2 py-2">{item.perimetro}</td>
                <td className="px-2 py-2 font-mono">{item.lotto}</td>
                <td className="px-2 py-2 whitespace-nowrap">{item.affidoIl}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {item.scadenzaMandato || "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {item.nPratiche}
                </td>
                <td
                  className="max-w-[10rem] truncate px-2 py-2 text-[var(--muted)]"
                  title={item.fileName ?? undefined}
                >
                  {item.fileName || "—"}
                </td>
                <td className="px-2 py-2 text-[var(--muted)]">
                  {item.createdByName || "—"}
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      title="Aggiorna o aggiungi pratiche a questo lotto"
                      onClick={() => integra(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-xs font-medium text-[var(--navy)] hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Integra
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId || importBatchBloccato(item)}
                      title={blocco || "Elimina import e pratiche"}
                      onClick={() => void elimina(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyId === item.id ? "…" : "Elimina"}
                    </button>
                  </div>
                  {blocco ? (
                    <p className="mt-1 max-w-[16rem] text-right text-[11px] leading-snug text-rose-700">
                      {blocco}
                    </p>
                  ) : null}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Con <strong>Integra</strong> aggiorni pratiche già presenti (anagrafica e contabile) e
        aggiungi righe nuove, senza duplicare e senza modificare note o codici scarico. Per il
        riconoscimento delle righe usa nel CSV almeno <span className="font-mono">contratto</span>,{" "}
        <span className="font-mono">commessa</span> o <span className="font-mono">cf</span>.{" "}
        <strong>Elimina</strong> solo se nessuna pratica ha note, cambi codice o incassi.
      </p>
    </div>
  );
}
