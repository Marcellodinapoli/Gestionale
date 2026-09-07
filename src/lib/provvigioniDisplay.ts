import type { LatoEconomico } from "@/lib/mandantePerimetri";
import { isModoNonProvvigionabile } from "@/lib/incassoFattura";
import type { PerimetroProvvigioniConfig } from "@/lib/provvigioniPerimetro";
import type { PerformanceProvvigioni } from "@/lib/provvigioniPerimetroUi";

export type ProvvigioneConPerimetro = {
  /** Chiave sezione (allineata a config.nome quando risolvibile). */
  perimetro: string;
  /** Etichetta UI del perimetro (acronimo · descrizione), non il lotto. */
  perimetroLabel?: string;
  baseImporto: number;
  importo: number;
  /** % effettivamente applicata all'incasso. */
  percentuale?: number;
  /** ve / np — se np escluso da incassato/calcolo. */
  modo?: string | null;
  fattura?: string | null;
};

export type SezioneProvvigioni<T extends ProvvigioneConPerimetro> = {
  perimetro: string;
  perimetroLabel: string;
  mandanteCodice: string;
  pagata: LatoEconomico | null;
  codiciScarico: { codice: string; descrizione: string }[];
  righe: T[];
  incassatoMese: number;
  /** Totale affidato pratiche del perimetro nel periodo (se disponibile). */
  affidatoTotale: number;
  /** Affidato del mese/perimetro per calcolo base incassato. */
  affidatoPeriodo: number;
  /** Metriche pezzi affido per scaglioni (stato attuale). */
  performance: PerformanceProvvigioni | null;
  provvigioniMese: number;
};

export function buildSezioniProvvigioni<T extends ProvvigioneConPerimetro>(
  righe: T[],
  configs: PerimetroProvvigioniConfig[],
  metriche?: Map<string, PerformanceProvvigioni>
): SezioneProvvigioni<T>[] {
  const configByNome = new Map(configs.map((c) => [c.nome, c]));
  const keys = configs.length
    ? configs.map((c) => c.nome)
    : [...new Set(righe.map((r) => r.perimetro || "—"))].sort((a, b) =>
        a.localeCompare(b, "it", { numeric: true })
      );

  for (const r of righe) {
    const p = r.perimetro || "—";
    if (!keys.includes(p)) keys.push(p);
  }

  return keys.map((perimetro) => {
    const righeSez = righe.filter((r) => (r.perimetro || "—") === perimetro);
    const cfg = configByNome.get(perimetro);
    const performance = metriche?.get(perimetro) ?? null;
    const labelFromRighe =
      righeSez.find((r) => r.perimetroLabel?.trim())?.perimetroLabel?.trim() || null;
    return {
      perimetro,
      perimetroLabel: cfg?.etichetta || labelFromRighe || perimetro,
      mandanteCodice: cfg?.mandanteCodice ?? "—",
      pagata: cfg?.pagata ?? null,
      codiciScarico: cfg?.codiciScarico ?? [],
      righe: righeSez,
      incassatoMese: righeSez.reduce(
        (s, r) => s + (isModoNonProvvigionabile(r.modo) ? 0 : r.baseImporto),
        0
      ),
      affidatoTotale: performance?.pezziAffido ?? 0,
      affidatoPeriodo: performance?.pezziAffido ?? 0,
      performance,
      provvigioniMese: righeSez.reduce((s, r) => s + r.importo, 0),
    };
  });
}

/** @deprecated usa buildSezioniProvvigioni */
export function sezioniProvvigioniPerimetro<T extends ProvvigioneConPerimetro>(
  righe: T[],
  perimetriConfigurati?: string[]
): Array<{ perimetro: string; righe: T[] }> {
  const configs = (perimetriConfigurati ?? []).map((nome) => ({
    nome,
    etichetta: nome,
    mandanteId: "",
    mandanteCodice: "—",
    pagata: {
      provvigionePerc: null,
      provvigioniMetodo: {},
      provvigioniCodice: {},
      incentivi: [],
      scaglioni: [],
    },
    codiciScarico: [],
  }));
  return buildSezioniProvvigioni(righe, configs).map((s) => ({
    perimetro: s.perimetro,
    righe: s.righe,
  }));
}
