"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CAMPI_RICERCA_PRATICA,
  type CampoRicercaPratica,
} from "@/lib/praticaCerca";

type Hit = {
  id: string;
  numero: string;
  debitore: string;
  telefono: string | null;
  mandante: string;
  assegnatario: string | null;
  statoLabel: string;
  residuoLabel: string;
  notaAnteprima?: string | null;
};

export function CercaPraticaPopup({
  praticaId,
  onDone,
}: {
  praticaId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [campo, setCampo] = useState<CampoRicercaPratica>("nominativo");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setTotal(0);
      setTruncated(false);
      setSearched(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ campo, q: term });
        const res = await fetch(`/api/pratiche-cerca?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          setHits([]);
          setTotal(0);
          setSearched(true);
          return;
        }
        const data = (await res.json()) as {
          pratiche: Hit[];
          total: number;
          truncated?: boolean;
        };
        if (cancelled) return;
        setHits(data.pratiche);
        setTotal(data.total);
        setTruncated(Boolean(data.truncated));
        setSearched(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [campo, q]);

  function apriPratica(id: string) {
    if (id === praticaId) {
      onDone?.();
      return;
    }
    router.push(`/pratiche/${id}`);
    onDone?.();
  }

  const placeholder =
    campo === "telefono"
      ? "Es. 3331234567"
      : campo === "contratto"
        ? "Es. PRC-2026-0001 o numero fattura"
        : campo === "note"
          ? "Es. promessa, bonifico, memo…"
          : "Es. Rossi Mario";

  return (
    <div className="flex min-h-[280px] flex-col p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {CAMPI_RICERCA_PRATICA.map((c) => (
          <label
            key={c.id}
            className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium ${
              campo === c.id
                ? "border-[#132033] bg-[#132033] text-white"
                : "border-[var(--line)] bg-white text-[#132033] hover:bg-[#eef4f8]"
            }`}
          >
            <input
              type="radio"
              name="campoRicerca"
              value={c.id}
              checked={campo === c.id}
              onChange={() => setCampo(c.id)}
              className="sr-only"
            />
            {c.label}
          </label>
        ))}
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-[var(--line)] pl-9 pr-3 text-sm"
        />
      </div>

      <p className="mb-2 text-[11px] text-[var(--muted)]">
        Digita almeno 2 caratteri.
        {campo === "note"
          ? " Cerca nel registro note e nelle note di pratica."
          : " Altri criteri di ricerca verranno aggiunti in seguito."}
      </p>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--line)] bg-white">
        {loading ? (
          <p className="p-4 text-sm text-[var(--muted)]">Ricerca in corso…</p>
        ) : q.trim().length < 2 ? (
          <p className="p-4 text-sm text-[var(--muted)]">Inserisci un termine di ricerca.</p>
        ) : hits.length ? (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Contratto</th>
                <th className="px-3 py-2">Debitore</th>
                <th className="px-3 py-2">Mand.</th>
                <th className="px-3 py-2">Stato</th>
                {campo === "note" ? (
                  <th className="px-3 py-2">Nota</th>
                ) : null}
                <th className="px-3 py-2 text-right">Residuo</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((p) => {
                const attuale = p.id === praticaId;
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-[var(--line)] ${
                      attuale ? "bg-[#fff3cd]" : "hover:bg-[#eef4f8]"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => apriPratica(p.id)}
                        className="font-mono text-[var(--accent)] underline"
                      >
                        {p.numero}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {p.debitore}
                      {p.telefono ? (
                        <div className="text-xs text-[var(--muted)]">{p.telefono}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{p.mandante}</td>
                    <td className="px-3 py-2">{p.statoLabel}</td>
                    {campo === "note" ? (
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-[var(--muted)]">
                        {p.notaAnteprima || "—"}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-right whitespace-nowrap">{p.residuoLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : searched ? (
          <p className="p-4 text-sm text-[var(--muted)]">Nessuna pratica trovata.</p>
        ) : null}
      </div>

      {searched && total > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          {total} risultat{total === 1 ? "o" : "i"}
          {truncated ? " (mostrati i primi 30)" : ""}
          {campo !== "note" ? (
            <>
              {" · "}
              <Link href={`/pratiche?q=${encodeURIComponent(q.trim())}`} className="underline">
                Apri in elenco pratiche
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
