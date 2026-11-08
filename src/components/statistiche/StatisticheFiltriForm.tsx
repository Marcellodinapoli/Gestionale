"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { PerimetroLottiGruppoFiltro } from "@/lib/statisticheGruppoUi";
import {
  FILTRI_BAR_CONTAINER_CLASS,
  FILTRI_LOTTO_BOX_CLASS,
  FILTRI_PAGE_INPUT_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
  FILTRI_RESET_BUTTON_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export function StatisticheFiltriForm({
  mandanti,
  lottiPerPerimetro,
  mandanteId,
  lottiSelezionati,
  grigliaAperta = false,
}: {
  mandanti: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lottiPerPerimetro: PerimetroLottiGruppoFiltro[];
  mandanteId?: string;
  lottiSelezionati: string[];
  /** Griglia visibile (lotto scelto). */
  grigliaAperta?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [mandanteCorrente, setMandanteCorrente] = useState(mandanteId ?? "");

  useEffect(() => {
    setMandanteCorrente(mandanteId ?? "");
  }, [mandanteId]);

  const sedeQs = sp.get("sede");
  const resetHref = sedeQs
    ? `/statistiche?sede=${encodeURIComponent(sedeQs)}`
    : "/statistiche";

  function oggiIso() {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function pushQuery(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `/statistiche?${qs}` : resetHref);
  }

  function baseQueryParams() {
    const qs = new URLSearchParams();
    const keepSede = sp.get("sede");
    if (keepSede) qs.set("sede", keepSede);
    const gruppo = sp.get("gruppo");
    if (gruppo) qs.set("gruppo", gruppo);
    const vista = sp.get("vista");
    if (vista) qs.set("vista", vista);
    return qs;
  }

  function onMandanteChange(mandanteVal: string) {
    setMandanteCorrente(mandanteVal);
    if (!mandanteVal) {
      router.push(resetHref);
      return;
    }
    const qs = baseQueryParams();
    qs.set("mandanteId", mandanteVal);
    pushQuery(qs);
  }

  function onLottoClick(lottoValue: string) {
    const mandato = mandanteId || mandanteCorrente;
    if (!mandato) return;

    const qs = baseQueryParams();
    qs.set("mandanteId", mandato);

    const giaAttivo =
      lottiSelezionati.length === 1 && lottiSelezionati[0] === lottoValue;
    if (giaAttivo) {
      pushQuery(qs);
      return;
    }

    const oggi = oggiIso();
    qs.set("cerca", "1");
    qs.set("lotto", lottoValue);
    qs.set("affidoDa", oggi);
    qs.set("affidoA", oggi);
    pushQuery(qs);
  }

  const dataOraOggi = new Date().toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className={`mb-3 space-y-2 ${FILTRI_BAR_CONTAINER_CLASS} bg-white`}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">
            Data e ora
          </span>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            value={dataOraOggi}
            className={`${FILTRI_PAGE_INPUT_CLASS} cursor-default bg-[#f5f7fa] text-[var(--navy)]`}
            aria-readonly="true"
          />
        </div>
        <label className="text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">Mandato</span>
          <select
            name="mandanteId"
            value={mandanteCorrente}
            onChange={(e) => onMandanteChange(e.target.value)}
            className={`min-w-[140px] ${FILTRI_PAGE_SELECT_CLASS}`}
          >
            <option value="">Seleziona</option>
            {mandanti.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codice}
              </option>
            ))}
          </select>
        </label>
        {mandanteId || grigliaAperta ? (
          <button
            type="button"
            onClick={() => router.push(resetHref)}
            className={FILTRI_RESET_BUTTON_CLASS}
          >
            Reset
          </button>
        ) : null}
      </div>

      {mandanteId ? (
        <div className="text-xs">
          <div className="mb-1 font-semibold text-[var(--muted)]">
            Perimetri e lotti in lavorazione
            {lottiSelezionati.length === 1
              ? ` · lotto ${lottiSelezionati[0]}`
              : ""}
          </div>
          {lottiPerPerimetro.length ? (
            <div
              className={`max-h-40 space-y-2 overflow-y-auto ${FILTRI_LOTTO_BOX_CLASS}`}
            >
              {lottiPerPerimetro.map((gruppo) => (
                <div key={gruppo.acronimo}>
                  <div className="mb-1 font-semibold tracking-wide text-[var(--navy)]">
                    {gruppo.acronimo}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-0.5">
                    {gruppo.lotti.map((lotto) => {
                      const on =
                        lottiSelezionati.length === 1 &&
                        lottiSelezionati[0] === lotto.value;
                      return (
                        <button
                          key={lotto.value}
                          type="button"
                          title={`Apri statistiche lotto ${lotto.value}`}
                          onClick={() => onLottoClick(lotto.value)}
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                            on
                              ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                              : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#eef4f8]"
                          }`}
                        >
                          {lotto.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[var(--muted)]">
              Nessun lotto in lavorazione oggi per questo mandato.
            </span>
          )}
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Clicca un <strong>lotto</strong> per aprire la griglia delle statistiche (giornata
            corrente). Clic di nuovo sul lotto attivo per chiudere la griglia.
          </p>
        </div>
      ) : null}
    </div>
  );
}
