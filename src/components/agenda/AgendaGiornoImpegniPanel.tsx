"use client";

import { useEffect, useState } from "react";
import { formatDataAgenda } from "@/lib/agendaVista";

type AgendaGiornoVoce = {
  kind: "pratica" | "libero";
  id: string;
  memoAt: string;
  label: string;
  dettaglio: string | null;
};

function formatOra(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgendaGiornoImpegniPanel({
  year,
  month,
  day,
  excludePraticaId,
}: {
  year: number;
  month: number;
  day: number;
  /** Pratica corrente: evidenziata come «questa pratica» */
  excludePraticaId?: string;
}) {
  const dataKey = formatDataAgenda(new Date(year, month, day));
  const [voci, setVoci] = useState<AgendaGiornoVoce[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agenda-giorno?data=${encodeURIComponent(dataKey)}`)
      .then(async (res) => {
        if (!res.ok) return { voci: [] as AgendaGiornoVoce[] };
        return (await res.json()) as { voci: AgendaGiornoVoce[] };
      })
      .then((data) => {
        if (!cancelled) setVoci(data.voci ?? []);
      })
      .catch(() => {
        if (!cancelled) setVoci([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataKey]);

  return (
    <div className="flex h-full min-h-[220px] min-w-0 flex-col rounded-md border border-[var(--line)] bg-[#f8fafc]">
      <div className="border-b border-[var(--line)] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
        Impegni del giorno
        {!loading ? (
          <span className="ml-1 font-semibold normal-case text-[var(--muted)]">
            · {voci.length}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-2.5 py-3 text-xs text-[var(--muted)]">Caricamento…</p>
        ) : voci.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-[var(--muted)]">
            Nessun altro impegno in questa data
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)] text-xs">
            {voci.map((v) => {
              const isCurrent =
                v.kind === "pratica" && excludePraticaId && v.id === excludePraticaId;
              return (
                <li
                  key={`${v.kind}-${v.id}`}
                  className={`flex gap-2 px-2.5 py-2 ${
                    isCurrent ? "bg-[#eef4f8]" : "bg-white"
                  }`}
                >
                  <span className="shrink-0 tabular-nums font-semibold text-[var(--navy)]">
                    {formatOra(v.memoAt)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--navy)]">
                      {v.label}
                      {isCurrent ? (
                        <span className="ml-1 text-[10px] font-normal text-[var(--muted)]">
                          (questa pratica)
                        </span>
                      ) : null}
                    </p>
                    {v.dettaglio ? (
                      <p className="truncate text-[10px] text-[var(--muted)]">{v.dettaglio}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
