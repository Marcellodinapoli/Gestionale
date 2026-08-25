"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEscBack } from "@/lib/useEscBack";
import { X } from "lucide-react";
import {
  buildPraticaCollegataHref,
  etichettaFiltroCollegata,
  type FiltroCollegata,
  praticaMatchFiltro,
} from "@/lib/praticaCollegata";
import { dataIt, euro } from "@/lib/domainFormat";
import { STATO_LABELS } from "@/lib/permissions";

type Voce = {
  id: string;
  numero: string;
  nome: string;
  stato: string;
  mandante: string;
  mandanteNome: string;
  residuo: number;
  scadenza: string | null;
};

export function PraticaCollegatePanel({
  praticaId,
  filtro,
  origineId,
}: {
  praticaId: string;
  filtro: FiltroCollegata;
  origineId?: string;
}) {
  const router = useRouter();
  const [corrente, setCorrente] = useState<Voce | null>(null);
  const [altre, setAltre] = useState<Voce[]>([]);
  const [altreChiuse, setAltreChiuse] = useState<Voce[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pratiche-stesso-debitore?id=${encodeURIComponent(praticaId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            corrente: Voce;
            altre: Voce[];
            altreChiuse: Voce[];
          } | null
        ) => {
        if (cancelled || !data) return;
        setCorrente(data.corrente);
        setAltre(data.altre);
        setAltreChiuse(data.altreChiuse);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [praticaId]);

  useEscBack(buildPraticaCollegataHref(praticaId, filtro, { da: origineId }));

  const lista = useMemo(() => {
    const tutte =
      filtro === "chiusa"
        ? corrente
          ? [corrente, ...altreChiuse]
          : altreChiuse
        : corrente
          ? [corrente, ...altre]
          : altre;
    return tutte
      .filter((p) => praticaMatchFiltro(p.stato, filtro))
      .sort((a, b) => a.numero.localeCompare(b.numero));
  }, [corrente, altre, altreChiuse, filtro]);

  function seleziona(p: Voce) {
    if (p.id === praticaId) return;
    router.push(
      buildPraticaCollegataHref(p.id, filtro, { elenco: true, da: origineId })
    );
  }

  function chiudi() {
    router.push(buildPraticaCollegataHref(praticaId, filtro, { da: origineId }));
  }

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-lg max-lg:max-h-[40vh] lg:w-[min(100%,380px)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] bg-[#dce4ec] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase text-[#1a365d]">
            Pratiche collegate
          </p>
          <p className="truncate text-[11px] text-[var(--muted)]">
            {etichettaFiltroCollegata(filtro)} · {lista.length}
          </p>
        </div>
        <button
          type="button"
          onClick={chiudi}
          className="rounded border border-[var(--line)] bg-white p-1 text-[var(--muted)] hover:bg-[#eef4f8]"
          title="Chiudi elenco (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <p className="p-4 text-sm text-[var(--muted)]">Caricamento…</p>
        ) : lista.length ? (
          <table className="w-full border-collapse font-mono text-[12px] leading-5 text-[#132033]">
            <thead className="sticky top-0 bg-[#eef2f6] text-left text-[10px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-2 py-1.5">Pratica</th>
                <th className="px-2 py-1.5">Mand.</th>
                <th className="px-2 py-1.5 text-right">Residuo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const attuale = p.id === praticaId;
                return (
                  <tr
                    key={p.id}
                    onClick={() => seleziona(p)}
                    className={`cursor-pointer border-t border-[var(--line)] ${
                      attuale
                        ? "bg-[#fff3cd]"
                        : "hover:bg-[#eef4f8]"
                    }`}
                    title={`${p.nome} · ${STATO_LABELS[p.stato] || p.stato}`}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] ${attuale ? "text-[var(--navy)]" : "text-transparent"}`}>
                          ▶
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{p.numero}</div>
                          <div className="truncate text-[10px] text-[var(--muted)]">
                            {STATO_LABELS[p.stato] || p.stato}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">{p.mandante}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {euro(p.residuo)}
                      {p.scadenza ? (
                        <div className="text-[10px] text-[var(--muted)]">
                          sc. {dataIt(p.scadenza)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-sm text-[var(--muted)]">Nessuna pratica in questa fase.</p>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--line)] bg-[#f5f7fa] px-3 py-2 text-[10px] text-[var(--muted)]">
        Clicca una riga per l&apos;anteprima a sinistra. Esc chiude l&apos;elenco.
      </div>
    </aside>
  );
}
