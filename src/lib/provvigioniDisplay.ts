import type { LatoEconomico } from "@/lib/mandantePerimetri";
import type { PerimetroProvvigioniConfig } from "@/lib/provvigioniPerimetro";

export type ProvvigioneConPerimetro = {
  perimetro: string;
  baseImporto: number;
  importo: number;
};

export type SezioneProvvigioni<T extends ProvvigioneConPerimetro> = {
  perimetro: string;
  mandanteCodice: string;
  pagata: LatoEconomico | null;
  codiciScarico: { codice: string; descrizione: string }[];
  righe: T[];
  incassatoMese: number;
  /** Totale affidato pratiche del perimetro nel periodo (se disponibile). */
  affidatoTotale: number;
  /** Affidato del mese/perimetro per calcolo base incassato. */
  affidatoPeriodo: number;
  provvigioniMese: number;
};

export function buildSezioniProvvigioni<T extends ProvvigioneConPerimetro>(
  righe: T[],
  configs: PerimetroProvvigioniConfig[]
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
    return {
      perimetro,
      mandanteCodice: cfg?.mandanteCodice ?? "—",
      pagata: cfg?.pagata ?? null,
      codiciScarico: cfg?.codiciScarico ?? [],
      righe: righeSez,
      incassatoMese: righeSez.reduce((s, r) => s + r.baseImporto, 0),
      affidatoTotale: 0,
      affidatoPeriodo: 0,
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
