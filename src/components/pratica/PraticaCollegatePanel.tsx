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
import {
  fetchPraticheStessoDebitore,
  peekPraticheStessoDebitore,
} from "@/lib/praticheStessoDebitoreClient";
import { dataIt, euro } from "@/lib/domainFormat";
import { STATO_LABELS } from "@/lib/permissions";

type Voce = {
  id: string;
  numero: string;
  nome: string;
  stato: string;
  codiceScarico?: string | null;
  mandante: string;
  mandanteNome: string;
  perimetro?: string | null;
  residuo: number;
  importoDaIncassare?: number;
  rateInsolute?: number | null;
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

    const cached = peekPraticheStessoDebitore(praticaId);
    if (cached) {
      setCorrente(cached.corrente);
      setAltre(cached.altre);
      setAltreChiuse(cached.altreChiuse);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    fetchPraticheStessoDebitore(praticaId)
      .then((data) => {
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

  function prefetchVoce(p: Voce) {
    if (p.id === praticaId) return;
    router.prefetch(
      buildPraticaCollegataHref(p.id, filtro, { elenco: true, da: origineId })
    );
  }

  function seleziona(p: Voce) {
    if (p.id === praticaId) return;
    const href = buildPraticaCollegataHref(p.id, filtro, {
      elenco: true,
      da: origineId,
    });
    router.prefetch(href);
    router.push(href);
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
                <th className="px-2 py-1.5">Mand. / Perim.</th>
                <th className="px-2 py-1.5 text-right">Da incassare</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const attuale = p.id === praticaId;
                const sottoStato = p.codiceScarico?.trim()
                  ? p.codiceScarico.trim()
                  : STATO_LABELS[p.stato] || p.stato;
                const importo =
                  p.importoDaIncassare != null ? p.importoDaIncassare : p.residuo;
                const perimetro = p.perimetro?.trim() || null;
                const rateInsolute =
                  p.rateInsolute != null && Number.isFinite(p.rateInsolute)
                    ? p.rateInsolute
                    : null;
                return (
                  <tr
                    key={p.id}
                    onClick={() => seleziona(p)}
                    onMouseEnter={() => prefetchVoce(p)}
                    onFocus={() => prefetchVoce(p)}
                    className={`cursor-pointer border-t border-[var(--line)] ${
                      attuale
                        ? "bg-[#fff3cd]"
                        : "hover:bg-[#eef4f8]"
                    }`}
                    title={`${p.nome} · ${sottoStato}${perimetro ? ` · ${perimetro}` : ""}`}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] ${attuale ? "text-[var(--navy)]" : "text-transparent"}`}>
                          ▶
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{p.numero}</div>
                          <div className="truncate text-[10px] text-[var(--muted)]">
                            {sottoStato}
                            {rateInsolute != null ? (
                              <span className="ml-1">
                                · {rateInsolute} insolute
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-semibold">{p.mandante}</div>
                      <div
                        className="max-w-[6.5rem] truncate text-[10px] text-[var(--muted)]"
                        title={perimetro || undefined}
                      >
                        {perimetro || "—"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {euro(importo)}
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
