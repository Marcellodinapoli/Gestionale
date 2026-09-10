/** Generazione scadenze piano effetti (cambiali/assegni) stile CreditCalc. */

import { addMonthsSameCalendarDay, round2 } from "@/lib/pdrPiano";

export type DistribuzionePianoEffetti = "mese_corrente" | "mensile";

export type EffettoIncassoLine = {
  numero: number;
  importo: number;
  /** Data registrazione / competenza. */
  data: Date;
  /** Scadenza effetto. */
  dataScadenza: Date;
};

/** Spezza un totale in N rate (ultima con conguaglio). */
export function splitImportiPianoEffetti(totale: number, n: number): number[] {
  const count = Math.max(0, Math.floor(n));
  if (count < 1) return [];
  const tot = round2(totale);
  if (tot <= 0) return [];
  const unit = round2(tot / count);
  const amounts = Array.from({ length: count }, () => unit);
  const sumExceptLast = round2(unit * (count - 1));
  amounts[count - 1] = round2(tot - sumExceptLast);
  return amounts;
}

/**
 * - mese_corrente: tutte le scadenze nel mese di `dataInizio` (stesso giorno).
 * - mensile: una scadenza al mese a partire da `dataInizio`.
 */
export function buildPianoEffettiSchedule(opts: {
  dataInizio: Date;
  n: number;
  importi: number[];
  distribuzione: DistribuzionePianoEffetti;
}): EffettoIncassoLine[] {
  const { dataInizio, n, importi, distribuzione } = opts;
  const lines: EffettoIncassoLine[] = [];
  for (let i = 0; i < n; i++) {
    const importo = importi[i] ?? 0;
    if (importo <= 0) continue;
    const scad =
      distribuzione === "mensile"
        ? addMonthsSameCalendarDay(dataInizio, i)
        : dataInizio;
    lines.push({
      numero: i + 1,
      importo: round2(importo),
      data: scad,
      dataScadenza: scad,
    });
  }
  return lines;
}
