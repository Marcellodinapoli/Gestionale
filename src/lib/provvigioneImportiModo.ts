import { isModoNonProvvigionabile, normalizeModoIncasso } from "@/lib/incassoFattura";
import { resolvePerimetroPratica } from "@/lib/mandantePerimetri";
import {
  calcolaProvvigione,
  resolveProvvigionePercentuale,
  resolveProvvigionePercentualeLato,
} from "@/lib/provvigioni";

export type MandanteProvvigioneInput = {
  provvigionePerc?: number | null;
  provvigioniMetodo?: string | null;
  perimetri?: string | null;
};

/** Importi provvigione in base a esito incasso (ve / np) e regole mandante. */
export function importiProvvigionePerModo(input: {
  modo?: string | null;
  baseImporto: number;
  metodo: string;
  codiceScarico?: string | null;
  numeroMandante?: string | null;
  mandante: MandanteProvvigioneInput;
}): { baseImporto: number; percentuale: number; importo: number } {
  const modo = normalizeModoIncasso(input.modo);
  const base = input.baseImporto;
  if (isModoNonProvvigionabile(modo)) {
    return { baseImporto: base, percentuale: 0, importo: 0 };
  }
  const perimetro = resolvePerimetroPratica(
    input.mandante.perimetri ?? null,
    input.numeroMandante ?? null
  );
  const pct = perimetro
    ? resolveProvvigionePercentualeLato(
        perimetro.pagata,
        input.metodo,
        input.codiceScarico ?? null
      )
    : resolveProvvigionePercentuale(input.mandante, input.metodo);
  const prov = calcolaProvvigione(base, pct);
  return {
    baseImporto: prov.baseImporto,
    percentuale: prov.percentuale,
    importo: prov.importo,
  };
}
