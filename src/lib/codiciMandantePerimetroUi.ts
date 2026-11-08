import {
  CODICI_SCARICO,
  type CodiceScarico,
} from "@/lib/scarico";

/** Tipi/colonne codici perimetro — senza Prisma/Firebase (safe per Client Components). */

export type CodiceConteggioKey = CodiceScarico | "ND";

export type RigaCodiciMandantePerimetro = {
  mandanteId: string;
  mandanteCodice: string;
  mandanteNome: string;
  perimetro: string;
  /** Pratiche con operatore assegnato (sit. affido = affidata). */
  affidate: number;
  /** Scadenza già passata (aperte, come card Home). */
  scadute: number;
  /** Stato AFFIDATA, IN_LAVORAZIONE o PROMESSA. */
  inLavorazione: number;
  conteggi: Record<CodiceConteggioKey, number>;
  totale: number;
};

export type RigaCodiciMandantePerimetroOperatore = RigaCodiciMandantePerimetro & {
  operatoreId: string;
  operatoreNome: string;
};

export type RigaInLavorazionePerimetro = {
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  count: number;
};

export type RigaDaAffidarePerimetro = RigaInLavorazionePerimetro;

export const COLONNE_CODICI: { key: CodiceConteggioKey; label: string }[] = [
  ...CODICI_SCARICO.map((c) => ({ key: c as CodiceConteggioKey, label: c })),
  { key: "ND", label: "Senza" },
];

export function emptyConteggi(): Record<CodiceConteggioKey, number> {
  return {
    PTC: 0,
    PPC: 0,
    MOV: 0,
    LPP: 0,
    LPT: 0,
    ND: 0,
  };
}
