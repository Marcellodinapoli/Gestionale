import type { Prisma } from "@prisma/client";

export const STATI_PRATICA_CHIUSA = ["INCASSO", "RESA", "INESIGIBILE"] as const;

export type NonToccateDa = 10;

export function sogliaGiorniFa(giorni: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - giorni);
  return d;
}

function inizioDomani() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

export function parseNonToccateDa(raw?: string | null): NonToccateDa | undefined {
  if (raw === "10") return 10;
  return undefined;
}

/**
 * Promessa con data di pagamento successiva a oggi:
 * stato/codice/esito promessa + promessaAt dal giorno successivo in poi.
 */
export function promessaConDataPosterioreWhere(): Prisma.PraticaWhereInput {
  return {
    AND: [
      {
        OR: [
          { stato: "PROMESSA" },
          { codiceScarico: "PPC" },
          { esitoContatto: "PROMESSA" },
        ],
      },
      { promessaAt: { gte: inizioDomani() } },
    ],
  };
}

/** Pratiche aperte senza aggiornamenti da almeno N giorni (ultimo tocco = updatedAt).
 * Esclude le promesse con data di pagamento posteriore a oggi.
 */
export function praticheNonToccateWhere(giorni: NonToccateDa): Prisma.PraticaWhereInput {
  return {
    updatedAt: { lt: sogliaGiorniFa(giorni) },
    stato: { notIn: [...STATI_PRATICA_CHIUSA] },
    NOT: promessaConDataPosterioreWhere(),
  };
}

export function etichettaNonToccateDa(giorni: NonToccateDa) {
  return `Dormienti da ${giorni}+ gg`;
}
