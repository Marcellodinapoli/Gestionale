import type {
  Incentivo,
  LatoEconomico,
  ScaglioneBase,
  ScaglioneProvvigione,
} from "@/lib/mandantePerimetri";
import {
  SCAGLIONE_BASE_LABELS,
  etichettaCodiceScaricoScaglione,
} from "@/lib/mandantePerimetri";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";
import { euro } from "@/lib/domainFormat";

/** Helper provvigioni puri — senza Prisma/Firebase (safe per Client Components). */

export type MetricheCodiceScarico = {
  incassato: number;
  affidatoTotale: number;
  affidatoPeriodo: number;
  /** Pezzi con codice scarico (su affido pratiche). */
  pezzi?: number;
  pezziAffido?: number;
};

export type PerformanceProvvigioni = {
  incassato: number;
  affidatoTotale: number;
  affidatoPeriodo?: number;
  pezziAffido?: number;
  perCodice?: Record<string, MetricheCodiceScarico>;
};

function metrichePerCodice(
  perf: PerformanceProvvigioni,
  codiceScarico: string | null | undefined
): MetricheCodiceScarico {
  const codice = codiceScarico?.trim().toUpperCase() || null;
  if (codice && perf.perCodice?.[codice]) {
    return perf.perCodice[codice]!;
  }
  if (codice && perf.perCodice) {
    return {
      incassato: 0,
      affidatoTotale: 0,
      affidatoPeriodo: 0,
      pezzi: 0,
      pezziAffido: perf.pezziAffido,
    };
  }
  return {
    incassato: perf.incassato,
    affidatoTotale: perf.affidatoTotale,
    affidatoPeriodo: perf.affidatoPeriodo ?? perf.affidatoTotale,
  };
}

export function performancePerc(
  base: ScaglioneBase,
  perf: PerformanceProvvigioni,
  codiceScarico?: string | null
): number {
  const m = metrichePerCodice(perf, codiceScarico);
  const codice = codiceScarico?.trim().toUpperCase() || null;
  const pezziAffido = m.pezziAffido ?? perf.pezziAffido ?? 0;

  if (base === "affidato" && codice && pezziAffido > 0 && m.pezzi != null) {
    return (m.pezzi / pezziAffido) * 100;
  }
  if (base === "affidato") {
    return m.affidatoTotale > 0 ? (m.incassato / m.affidatoTotale) * 100 : 0;
  }
  const denominatore = m.affidatoPeriodo || m.affidatoTotale;
  return denominatore > 0 ? (m.incassato / denominatore) * 100 : 0;
}

/** Pezzi codice obiettivo mancanti per raggiungere lo scaglione (base affido pratiche). */
export function mancanoPezziPerScaglione(
  scaglione: ScaglioneProvvigione,
  perf: PerformanceProvvigioni
): { codice: string; mancano: number; attuali: number; obiettivo: number; pezziAffido: number } | null {
  const codice = scaglione.codiceScarico?.trim().toUpperCase();
  if (!codice || scaglione.base !== "affidato") return null;

  const m = metrichePerCodice(perf, codice);
  const pezziAffido = m.pezziAffido ?? perf.pezziAffido ?? 0;
  const pezzi = m.pezzi ?? 0;
  if (pezziAffido <= 0) return null;

  const obiettivo = Math.ceil((scaglione.sogliaPerc / 100) * pezziAffido);
  return {
    codice,
    mancano: Math.max(0, obiettivo - pezzi),
    attuali: pezzi,
    obiettivo,
    pezziAffido,
  };
}

export function provvigionePercEffettiva(
  lato: LatoEconomico,
  perf: PerformanceProvvigioni,
  codiceScarico?: string | null
): number {
  const codice = codiceScarico?.trim().toUpperCase() || "";
  let perc =
    codice && lato.provvigioniCodice?.[codice] != null
      ? lato.provvigioniCodice[codice]!
      : (lato.provvigionePerc ?? 0);
  for (const s of [...lato.scaglioni].sort((a, b) => a.sogliaPerc - b.sogliaPerc)) {
    if (performancePerc(s.base, perf, s.codiceScarico) >= s.sogliaPerc) {
      perc = s.provvigionePerc;
    }
  }
  return perc;
}

export function scaglioneProvvigioneAttuale(
  perf: PerformanceProvvigioni,
  scaglioni: ScaglioneProvvigione[]
): { attuale: ScaglioneProvvigione | null; prossimo: ScaglioneProvvigione | null } {
  if (!scaglioni.length) return { attuale: null, prossimo: null };

  const sorted = [...scaglioni].sort((a, b) => a.sogliaPerc - b.sogliaPerc);
  let attuale: ScaglioneProvvigione | null = null;
  let prossimo: ScaglioneProvvigione | null = null;

  for (const s of sorted) {
    const raggiunto = performancePerc(s.base, perf, s.codiceScarico) >= s.sogliaPerc;
    if (raggiunto) {
      attuale = s;
    } else if (!prossimo) {
      prossimo = s;
    }
  }

  if (!prossimo && !attuale) prossimo = sorted[0] ?? null;
  return { attuale, prossimo };
}

export function etichettaScaglione(s: ScaglioneProvvigione) {
  const base = SCAGLIONE_BASE_LABELS[s.base].replace(/^%\s*/, "");
  const codice = etichettaCodiceScaricoScaglione(s.codiceScarico);
  const note = s.note ? ` — ${s.note}` : "";
  return `≥ ${s.sogliaPerc}% ${base} · cod. ${codice} → provv. ${s.provvigionePerc}%${note}`;
}

export function etichettaScaglioni(lato: LatoEconomico) {
  return lato.scaglioni.map(etichettaScaglione);
}

export function etichettaIncentivoCash(inc: Incentivo) {
  const val = euro(inc.valore);
  const soglia =
    inc.soglia != null ? ` · soglia incasso ${euro(inc.soglia)}` : "";
  const note = inc.note ? ` — ${inc.note}` : "";
  return `${val} (cash)${soglia}${note}`;
}

export function etichettaIncentiviCash(lato: LatoEconomico) {
  return lato.incentivi.map(etichettaIncentivoCash);
}

/** @deprecated usa etichettaIncentiviCash */
export function etichettaIncentivi(lato: LatoEconomico) {
  return etichettaIncentiviCash(lato);
}

/** @deprecated usa etichettaIncentiviCash */
export function etichettaIncentivo(lato: LatoEconomico) {
  const labels = etichettaIncentiviCash(lato);
  return labels.length ? labels.join(" · ") : null;
}

export function provvigioniMetodoLabelEntries(lato: LatoEconomico) {
  return Object.entries(lato.provvigioniMetodo).map(([metodo, perc]) => ({
    metodo,
    label: metodoIncassoLabel(metodo),
    perc,
  }));
}

export function provvigioniCodiceLabelEntries(
  lato: LatoEconomico,
  codiciPerimetro: { codice: string; descrizione: string }[] = []
) {
  return Object.entries(lato.provvigioniCodice ?? {}).map(([codice, perc]) => {
    const custom = codiciPerimetro.find((c) => c.codice.toUpperCase() === codice);
    return {
      codice,
      label: custom?.descrizione.trim()
        ? `${codice} — ${custom.descrizione.trim()}`
        : codice,
      perc,
    };
  });
}
