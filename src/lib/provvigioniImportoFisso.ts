import { provvigioneStatoLabel } from "@/lib/provvigioni";
import type { CondizioneEconomica } from "@/lib/condizioneEconomica";

export const IMPORTO_FISSO_PROVV_ID_PREFIX = "fisso:";

export function isImportoFissoProvvigioneId(id: string): boolean {
  return id.startsWith(IMPORTO_FISSO_PROVV_ID_PREFIX);
}

export type OperatoreImportoFisso = {
  id: string;
  name: string;
  condizioneEconomica: CondizioneEconomica;
  importoFisso: number | null;
};

export type RigaProvvigioneImportoFisso = {
  id: string;
  praticaId: string;
  praticaNumero: string;
  debitoreNome: string;
  operatoreNome: string;
  data: string;
  baseImporto: number;
  percentuale: number;
  importo: number;
  stato: string;
  statoLabel: string;
  perimetro: string;
  codiceScarico: string;
};

export function buildRigheImportoFisso(
  operatori: OperatoreImportoFisso[],
  meseLabel: string
): RigaProvvigioneImportoFisso[] {
  return operatori
    .filter(
      (o) =>
        o.condizioneEconomica === "FISSO_PROVV" &&
        o.importoFisso != null &&
        o.importoFisso > 0
    )
    .map((o) => ({
      id: `${IMPORTO_FISSO_PROVV_ID_PREFIX}${o.id}`,
      praticaId: "",
      praticaNumero: "—",
      debitoreNome: "Importo fisso mensile",
      operatoreNome: o.name,
      data: meseLabel,
      baseImporto: o.importoFisso!,
      percentuale: 0,
      importo: o.importoFisso!,
      stato: "MATURATA",
      statoLabel: provvigioneStatoLabel("MATURATA"),
      perimetro: "Compenso fisso",
      codiceScarico: "—",
    }));
}

export function totaleImportoFisso(righe: RigaProvvigioneImportoFisso[]): number {
  return righe.reduce((s, r) => s + r.importo, 0);
}
