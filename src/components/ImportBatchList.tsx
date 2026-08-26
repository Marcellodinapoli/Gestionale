"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { eliminaImportBatchAction } from "@/actions/importBatch";
import {
  importBatchBloccato,
  type ImportBatchListItem,
} from "@/lib/importBatch";

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

function motivoBlocco(item: ImportBatchListItem) {
  const parti: string[] = [];
  if (item.hasNote) parti.push("note");
  if (item.hasCambioCodice) parti.push("cambi codice");
  if (item.hasMovimenti) parti.push("movimenti");
  if (!parti.length) return null;
  return `Non eliminabile: ci sono ${parti.join(", ")} sulle pratiche`;
}

export function ImportBatchList({ items }: { items: ImportBatchListItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function integra(item: ImportBatchListItem) {
    const sp = new URLSearchParams();
    sp.set("integra", item.id);
    router.push(`/import?${sp.toString()}#import-pratiche`);
  }

  async function elimina(item: ImportBatchListItem) {
    if (importBatchBloccato(item)) return;
    const ok = window.confirm(
      `Eliminare l'import del ${formatQuando(item.createdAt)}?\n` +
        `Lotto ${item.lotto} · ${item.nPratiche} pratiche · ${item.mandanteCodice}\n` +
        `L'operazione non è reversibile.`
    );
    if (!ok) return;

    setBusyId(item.id);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("batchId", item.id);
      const res = await eliminaImportBatchAction(fd);
      if (res?.error) setMessage(res.error);
      else if (res?.ok) {
        setMessage(res.ok);
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Eliminazione non riuscita");
    } finally {
      setBusyId(null);
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
            <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-2 py-2 font-semibold">Data</th>
              <th className="px-2 py-2 font-semibold">Mandante</th>
              <th className="px-2 py-2 font-semibold">Perimetro</th>
              <th className="px-2 py-2 font-semibold">Lotto</th>
              <th className="px-2 py-2 font-semibold">Affido</th>
              <th className="px-2 py-2 font-semibold text-right">Pratiche</th>
              <th className="px-2 py-2 font-semibold">File</th>
              <th className="px-2 py-2 font-semibold">Utente</th>
              <th className="px-2 py-2 font-semibold text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
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
                      title="Aggiungi pratiche a questo lotto"
                      onClick={() => integra(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-xs font-medium text-[var(--navy)] hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Integra
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId || importBatchBloccato(item)}
                      title={
                        motivoBlocco(item) || "Elimina import e pratiche"
                      }
                      onClick={() => void elimina(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyId === item.id ? "…" : "Elimina"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Con <strong>Integra</strong> aggiungi pratiche a un lotto già caricato
        (anche se ci sono note, cambi codice o movimenti).{" "}
        <strong>Elimina</strong> solo se nessuna pratica ha note, cambi codice o
        incassi.
      </p>
    </div>
  );
}
