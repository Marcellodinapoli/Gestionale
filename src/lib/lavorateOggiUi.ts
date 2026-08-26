/** Helper data/UI lavorate — senza Prisma/Firebase (safe per Client Components). */

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfToday() {
  return startOfDay(new Date());
}

export function startOfNextDay(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

export function intervalloGiornata(data: Date) {
  return { gte: startOfDay(data), lt: startOfNextDay(data) };
}

/** Fascia oraria lavorazione: mattina 09:00–13:30, pomeriggio 13:31–19:00. */
export type LavorateFascia = "mattina" | "pomeriggio";

export function parseLavorateFascia(value?: string | null): LavorateFascia | undefined {
  if (value === "mattina" || value === "pomeriggio") return value;
  return undefined;
}

export function intervalloFasciaOraria(data: Date, fascia: LavorateFascia) {
  const day = startOfDay(data);
  if (fascia === "mattina") {
    const gte = new Date(day);
    gte.setHours(9, 0, 0, 0);
    const lt = new Date(day);
    lt.setHours(13, 30, 1, 0);
    return { gte, lt };
  }
  const gte = new Date(day);
  gte.setHours(13, 31, 0, 0);
  const lt = new Date(day);
  lt.setHours(19, 0, 1, 0);
  return { gte, lt };
}

export function formatDataIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDataIso(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

export function isOggi(d: Date) {
  return formatDataIso(d) === formatDataIso(new Date());
}

export function resolveLavorateGiorno(opts: {
  lavorateData?: string | null;
  lavorateOggi?: boolean;
}): Date | undefined {
  const parsed = parseDataIso(opts.lavorateData);
  if (parsed) return parsed;
  if (opts.lavorateOggi) return startOfToday();
  return undefined;
}

export type PraticaLavorataOggi = {
  praticaId: string;
  userId: string;
  sigla: string;
  name: string;
};

export type OperatoreLavorateGiorno = {
  userId: string;
  name: string;
  sigla: string;
  count: number;
  cambiCodice: number;
};

import type { CodiceScarico } from "@/lib/scarico";

export type CodiceLavorazioneConteggio = {
  codice: CodiceScarico;
  pratiche: number;
};

export type RiepilogoCodiciLavorazione = {
  codici: CodiceLavorazioneConteggio[];
  senzaCodice: number;
  totalePratiche: number;
};

export type PraticaCambioCodiceGiorno = {
  praticaId: string;
  numero: string;
  debitore: string;
  da: string;
  a: string;
  userId: string | null;
};
