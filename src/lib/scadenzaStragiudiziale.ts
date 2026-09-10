import { addWorkingDays, startOfLocalDay } from "@/lib/workingDays";
import { isStragiudizialePrevistoSulLotto } from "@/lib/conferimentoLegale";

/** Anticipo per avvio giudiziale (giorni lavorativi). */
export const PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI = 10;

export const PREAVVISO_STRAGIUDIZIALE_PARAM = "preavvisoStragiudiziale";

/**
 * Scadenza stragiudiziale effettiva:
 * - se attività stragiudiziale non prevista (solo giudiziale) → null (resta solo scadenza mandato)
 * - altrimenti dataPassaggioGiudiziale se valorizzata, altrimenti scadenza mandato
 */
export function scadenzaStragiudizialeEffettiva(input: {
  scadenza?: Date | string | null;
  dataPassaggioGiudiziale?: Date | string | null;
  conferimentoTipo?: string | null;
}): Date | null {
  if (!isStragiudizialePrevistoSulLotto(input.conferimentoTipo)) return null;
  const passaggio = toDate(input.dataPassaggioGiudiziale);
  if (passaggio) return startOfLocalDay(passaggio);
  const scad = toDate(input.scadenza);
  return scad ? startOfLocalDay(scad) : null;
}

function toDate(v?: Date | string | null): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fine finestra preavviso (oggi + N gg lavorativi). */
export function fineFinestraPreavvisoStragiudiziale(
  now = new Date(),
  ggLav = PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI
): Date {
  return addWorkingDays(startOfLocalDay(now), ggLav);
}

/**
 * In dirittura (oggi…+N) oppure già scaduta.
 * Confronta solo la data (mezzogiorno locale).
 */
export function isPreavvisoStragiudiziale(
  effective: Date | null,
  now = new Date(),
  ggLav = PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI
): boolean {
  if (!effective) return false;
  const today = startOfLocalDay(now);
  const end = fineFinestraPreavvisoStragiudiziale(now, ggLav);
  const day = startOfLocalDay(effective);
  return day.getTime() <= end.getTime();
}

export function isScadutaStragiudiziale(
  effective: Date | null,
  now = new Date()
): boolean {
  if (!effective) return false;
  return startOfLocalDay(effective).getTime() < startOfLocalDay(now).getTime();
}

/** Stati pratica esclusi dal preavviso. */
export const STATI_ESCLUSI_PREAVVISO_STRAGIUDIZIALE = [
  "INCASSO",
  "RESA",
  "INESIGIBILE",
] as const;

/** Stati giudiziale che escludono dal preavviso. */
export const STATI_GIUDIZIALE_ESCLUSI_PREAVVISO = [
  "ARCHIVIATA_SENZA_AZIONE",
  "CONCLUSA_CON_ESITO",
] as const;

/** Esclude lotti solo giudiziali dalla scadenza/preavviso stragiudiziale. */
function whereStragiudizialePrevisto(): Record<string, unknown> {
  return {
    NOT: { conferimentoTipo: "GIUDIZIALE" },
  };
}

/**
 * Where Prisma: scadenza stragiudiziale effettiva in intervallo (Da/A inclusivo).
 * effective = coalesce(dataPassaggioGiudiziale, scadenza); escluso solo-giudiziale.
 */
export function whereScadenzaStragiudizialeRange(range: {
  gte?: Date;
  lt?: Date;
}): Record<string, unknown> {
  return {
    AND: [
      whereStragiudizialePrevisto(),
      {
        OR: [
          {
            dataPassaggioGiudiziale: { not: null, ...range },
          },
          {
            dataPassaggioGiudiziale: null,
            scadenza: { not: null, ...range },
          },
        ],
      },
    ],
  };
}

/**
 * Where Prisma: pratiche in preavviso / scadute stragiudiziale.
 * effective = coalesce(dataPassaggioGiudiziale, scadenza) <= fineFinestra.
 */
export function wherePreavvisoStragiudiziale(
  now = new Date(),
  ggLav = PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI
): Record<string, unknown> {
  const end = fineFinestraPreavvisoStragiudiziale(now, ggLav);
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  endExclusive.setHours(0, 0, 0, 0);

  const notGiudizialeChiuso = {
    NOT: {
      giudiziale: {
        statoAvvio: { in: [...STATI_GIUDIZIALE_ESCLUSI_PREAVVISO] },
      },
    },
  };

  return {
    stato: { notIn: [...STATI_ESCLUSI_PREAVVISO_STRAGIUDIZIALE] },
    AND: [
      notGiudizialeChiuso,
      whereScadenzaStragiudizialeRange({ lt: endExclusive }),
    ],
  };
}
