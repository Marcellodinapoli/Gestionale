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

/** Fascia oraria lavorazione: giornata 09:00–19:00 divisa in tre parti uguali (3h 20m). */
export type LavorateFascia = "mattina" | "pranzo" | "pomeriggio";

export const LAVORATE_FASCE: {
  value: LavorateFascia;
  label: string;
  range: string;
}[] = [
  { value: "mattina", label: "Mattina", range: "09:00–12:20" },
  { value: "pranzo", label: "Pranzo", range: "12:21–15:40" },
  { value: "pomeriggio", label: "Pomeriggio", range: "15:41–19:00" },
];

export function parseLavorateFascia(value?: string | null): LavorateFascia | undefined {
  if (value === "mattina" || value === "pranzo" || value === "pomeriggio") return value;
  return undefined;
}

export function labelLavorateFascia(fascia: LavorateFascia): string {
  const hit = LAVORATE_FASCE.find((f) => f.value === fascia);
  return hit ? `${hit.label.toLowerCase()} (${hit.range})` : fascia;
}

function boundary(day: Date, hours: number, minutes: number, seconds = 0) {
  const d = new Date(day);
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

export function intervalloFasciaOraria(data: Date, fascia: LavorateFascia) {
  const day = startOfDay(data);
  switch (fascia) {
    case "mattina":
      return { gte: boundary(day, 9, 0), lt: boundary(day, 12, 20, 1) };
    case "pranzo":
      return { gte: boundary(day, 12, 21), lt: boundary(day, 15, 40, 1) };
    case "pomeriggio":
      return { gte: boundary(day, 15, 41), lt: boundary(day, 19, 0, 1) };
  }
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
