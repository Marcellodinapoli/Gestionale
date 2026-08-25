import { prisma } from "@/lib/prisma";
import type {
  Incentivo,
  LatoEconomico,
  ScaglioneBase,
  ScaglioneProvvigione,
} from "@/lib/mandantePerimetri";
import { parsePerimetri, numeroMandantePerimetro, SCAGLIONE_BASE_LABELS, etichettaCodiceScaricoScaglione } from "@/lib/mandantePerimetri";
import type { GruppoMandanteAssegnazione } from "@/lib/gruppoMandanti";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";
import { euro } from "@/lib/domain";

export type PerimetroProvvigioniConfig = {
  nome: string;
  mandanteId: string;
  mandanteCodice: string;
  /** Regole pagate agli operatori su questo perimetro. */
  pagata: LatoEconomico;
  codiciScarico: { codice: string; descrizione: string }[];
};

export async function configProvvigioniPerimetriGruppo(
  tenantId: string,
  assegnazioni: GruppoMandanteAssegnazione[]
): Promise<PerimetroProvvigioniConfig[]> {
  if (!assegnazioni.length) return [];

  const mandantiDb = await prisma.mandante.findMany({
    where: {
      tenantId,
      id: { in: [...new Set(assegnazioni.map((a) => a.mandanteId))] },
    },
    select: { id: true, codice: true, perimetri: true },
  });

  const out: PerimetroProvvigioniConfig[] = [];
  for (const a of assegnazioni) {
    const m = mandantiDb.find((x) => x.id === a.mandanteId);
    if (!m) continue;
    const perimetri = parsePerimetri(m.perimetri);
    const targets = !a.perimetriIds.length
      ? perimetri
      : a.perimetriIds
          .map((id) => perimetri.find((p) => p.id === id))
          .filter((p): p is (typeof perimetri)[number] => Boolean(p));

    for (const p of targets) {
      out.push({
        nome: numeroMandantePerimetro(p),
        mandanteId: m.id,
        mandanteCodice: m.codice,
        pagata: p.pagata,
        codiciScarico: p.codiciScarico,
      });
    }
  }

  return out.sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { numeric: true })
  );
}

/** Config provvigioni per mandato/perimetro (ufficio amministrazione, filtri tenant). */
export async function configProvvigioniMandanti(
  tenantId: string,
  opts?: { mandanteIds?: string[]; soloPerimetro?: string }
): Promise<PerimetroProvvigioniConfig[]> {
  const mandantiDb = await prisma.mandante.findMany({
    where: {
      tenantId,
      ...(opts?.mandanteIds?.length ? { id: { in: opts.mandanteIds } } : {}),
    },
    select: { id: true, codice: true, perimetri: true },
    orderBy: { codice: "asc" },
  });

  const out: PerimetroProvvigioniConfig[] = [];
  for (const m of mandantiDb) {
    for (const p of parsePerimetri(m.perimetri)) {
      const nome = numeroMandantePerimetro(p);
      if (!nome) continue;
      if (opts?.soloPerimetro && opts.soloPerimetro !== nome) continue;
      out.push({
        nome,
        mandanteId: m.id,
        mandanteCodice: m.codice,
        pagata: p.pagata,
        codiciScarico: p.codiciScarico,
      });
    }
  }

  return out.sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { numeric: true })
  );
}

export type MetricheCodiceScarico = {
  incassato: number;
  affidatoTotale: number;
  affidatoPeriodo: number;
};

export type PerformanceProvvigioni = {
  incassato: number;
  /** Totale affidato di riferimento (portfolio). */
  affidatoTotale: number;
  /** Affidato del periodo/mese (per base incassato). Default = incassato se non disponibile. */
  affidatoPeriodo?: number;
  /** Metriche filtrate per codice scarico (chiave = codice upper case). */
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
    return { incassato: 0, affidatoTotale: 0, affidatoPeriodo: 0 };
  }
  return {
    incassato: perf.incassato,
    affidatoTotale: perf.affidatoTotale,
    affidatoPeriodo: perf.affidatoPeriodo ?? perf.affidatoTotale,
  };
}

/** % raggiunta in base al tipo scaglione e al codice selezionato. */
export function performancePerc(
  base: ScaglioneBase,
  perf: PerformanceProvvigioni,
  codiceScarico?: string | null
): number {
  const m = metrichePerCodice(perf, codiceScarico);
  if (base === "affidato") {
    return m.affidatoTotale > 0 ? (m.incassato / m.affidatoTotale) * 100 : 0;
  }
  const denominatore = m.affidatoPeriodo || m.affidatoTotale;
  return denominatore > 0 ? (m.incassato / denominatore) * 100 : 0;
}

/** Provvigione % effettiva: base (per codice) sostituita dallo scaglione più alto raggiunto. */
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
  const base = SCAGLIONE_BASE_LABELS[s.base];
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
