import type { Prisma } from "@prisma/client";
import { startOfDay } from "@/lib/lavorateOggiUi";

/** Rata non pagata con scadenza precedente a oggi (inizio giornata). */
export function isRataScaduta(
  rata: { pagata: boolean; scadenza: Date },
  now = new Date()
) {
  if (rata.pagata) return false;
  return rata.scadenza.getTime() < startOfDay(now).getTime();
}

export function countRateScadute(
  rate: Array<{ pagata: boolean; scadenza: Date }>,
  now = new Date()
) {
  return rate.filter((r) => isRataScaduta(r, now)).length;
}

/** Where Prisma: pratica con almeno una rata scaduta. */
export function rateScaduteSomeWhere(now = new Date()): Prisma.PraticaWhereInput {
  return {
    rate: {
      some: {
        pagata: false,
        scadenza: { lt: startOfDay(now) },
      },
    },
  };
}
