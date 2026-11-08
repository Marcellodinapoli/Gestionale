import type { Prisma } from "@prisma/client";
import { startOfDay } from "@/lib/lavorateOggiUi";

function scadenzaRataDate(scadenza: Date | string): Date | null {
  const d = scadenza instanceof Date ? scadenza : new Date(scadenza);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Rata non pagata con scadenza precedente a oggi (inizio giornata). */
export function isRataScaduta(
  rata: { pagata: boolean; scadenza: Date | string },
  now = new Date()
) {
  if (rata.pagata) return false;
  const scadenza = scadenzaRataDate(rata.scadenza);
  if (!scadenza) return false;
  return scadenza.getTime() < startOfDay(now).getTime();
}

export function countRateScadute(
  rate: Array<{ pagata: boolean; scadenza: Date | string }>,
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
