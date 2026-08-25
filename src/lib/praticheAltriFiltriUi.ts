/**
 * Tipi e helper filtri pratiche — sicuri per Client Component (niente Prisma).
 */

export const ALTRI_FILTRI_KEYS = [
  "debitore",
  "capDa",
  "capA",
  "citta",
  "prov",
  "telefono",
  "affidoDa",
  "affidoA",
  "scadenzaDa",
  "scadenzaA",
  "mandato",
  "lotto",
  "operatore",
  "codScarico",
  "sitAffido",
  "affidoProvvisorio",
  "importoRataDa",
  "importoRataA",
  "residuoDa",
  "residuoA",
  "totIncassatoDa",
  "totIncassatoA",
  "importoTotDa",
  "importoTotA",
  "cfPiva",
  "garante",
  "note",
  "nPraticaDa",
  "nPraticaA",
  "promPagDa",
  "promPagA",
  "incassatoDa",
  "incassatoA",
  "memoDa",
  "memoA",
  "rateScadute",
  "aggiuntivo",
] as const;

export type AltriFiltriKey = (typeof ALTRI_FILTRI_KEYS)[number];

export const FILTRI_GESTIONE_KEYS = ALTRI_FILTRI_KEYS.filter((k) => k !== "aggiuntivo");

export type SitAffidoFiltro = "affidata" | "non_affidata" | "temporanea";

export type AltriFiltri = {
  debitore?: string;
  capDa?: string;
  capA?: string;
  citta?: string;
  prov?: string;
  telefono?: string;
  affidoDa?: string;
  affidoA?: string;
  scadenzaDa?: string;
  scadenzaA?: string;
  mandato?: string;
  lotto?: string;
  operatore?: string;
  codScarico?: string;
  sitAffido?: SitAffidoFiltro;
  affidoProvvisorio?: string;
  importoRataDa?: string;
  importoRataA?: string;
  residuoDa?: string;
  residuoA?: string;
  totIncassatoDa?: string;
  totIncassatoA?: string;
  importoTotDa?: string;
  importoTotA?: string;
  cfPiva?: string;
  garante?: string;
  note?: string;
  nPraticaDa?: string;
  nPraticaA?: string;
  promPagDa?: string;
  promPagA?: string;
  incassatoDa?: string;
  incassatoA?: string;
  memoDa?: string;
  memoA?: string;
  rateScadute?: string;
  aggiuntivo?: string;
};

function trimOrUndef(v?: string | null) {
  const t = String(v || "").trim();
  return t || undefined;
}

export function parseAltriFiltri(
  sp: Record<string, string | null | undefined>
): AltriFiltri | undefined {
  const f: AltriFiltri = {
    debitore: trimOrUndef(sp.debitore),
    capDa: trimOrUndef(sp.capDa),
    capA: trimOrUndef(sp.capA),
    citta: trimOrUndef(sp.citta),
    prov: trimOrUndef(sp.prov),
    telefono: trimOrUndef(sp.telefono),
    affidoDa: trimOrUndef(sp.affidoDa),
    affidoA: trimOrUndef(sp.affidoA),
    scadenzaDa: trimOrUndef(sp.scadenzaDa),
    scadenzaA: trimOrUndef(sp.scadenzaA),
    mandato: trimOrUndef(sp.mandato),
    lotto: trimOrUndef(sp.lotto),
    operatore: trimOrUndef(sp.operatore),
    codScarico: trimOrUndef(sp.codScarico),
    sitAffido:
      sp.sitAffido === "affidata" ||
      sp.sitAffido === "non_affidata" ||
      sp.sitAffido === "temporanea"
        ? sp.sitAffido
        : undefined,
    affidoProvvisorio: sp.affidoProvvisorio === "1" ? "1" : undefined,
    importoRataDa: trimOrUndef(sp.importoRataDa),
    importoRataA: trimOrUndef(sp.importoRataA),
    residuoDa: trimOrUndef(sp.residuoDa),
    residuoA: trimOrUndef(sp.residuoA),
    totIncassatoDa: trimOrUndef(sp.totIncassatoDa),
    totIncassatoA: trimOrUndef(sp.totIncassatoA),
    importoTotDa: trimOrUndef(sp.importoTotDa),
    importoTotA: trimOrUndef(sp.importoTotA),
    cfPiva: trimOrUndef(sp.cfPiva),
    garante: trimOrUndef(sp.garante),
    note: trimOrUndef(sp.note),
    nPraticaDa: trimOrUndef(sp.nPraticaDa),
    nPraticaA: trimOrUndef(sp.nPraticaA),
    promPagDa: trimOrUndef(sp.promPagDa),
    promPagA: trimOrUndef(sp.promPagA),
    incassatoDa: trimOrUndef(sp.incassatoDa),
    incassatoA: trimOrUndef(sp.incassatoA),
    memoDa: trimOrUndef(sp.memoDa),
    memoA: trimOrUndef(sp.memoA),
    rateScadute: sp.rateScadute === "1" || sp.rateScadute === "0" ? sp.rateScadute : undefined,
    aggiuntivo: trimOrUndef(sp.aggiuntivo),
  };
  if (!ALTRI_FILTRI_KEYS.some((k) => f[k])) return undefined;
  return f;
}

export function sanitizeAltriFiltri(raw: unknown): AltriFiltri {
  if (!raw || typeof raw !== "object") return {};
  return parseAltriFiltri(raw as Record<string, string | null | undefined>) ?? {};
}

export function appendAltriFiltriParams(sp: URLSearchParams, f?: AltriFiltri | null) {
  if (!f) return;
  for (const k of ALTRI_FILTRI_KEYS) {
    const v = f[k];
    if (v) sp.set(k, v);
  }
}

export function hasAltriFiltri(f?: AltriFiltri | null) {
  return Boolean(f && ALTRI_FILTRI_KEYS.some((k) => f[k]));
}

function fmtDataFiltro(iso?: string) {
  if (!iso) return "…";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT");
  }
  return iso;
}

const FILTRI_DESCRIZIONI: Partial<Record<AltriFiltriKey, (f: AltriFiltri) => string | undefined>> = {
  debitore: (f) => (f.debitore ? `Debitore: ${f.debitore}` : undefined),
  citta: (f) => (f.citta ? `Città: ${f.citta}` : undefined),
  affidoDa: (f) =>
    f.affidoDa || f.affidoA
      ? `Affido ${fmtDataFiltro(f.affidoDa)}–${fmtDataFiltro(f.affidoA)}`
      : undefined,
  promPagDa: (f) =>
    f.promPagDa || f.promPagA
      ? `Prom. pag. ${fmtDataFiltro(f.promPagDa)}–${fmtDataFiltro(f.promPagA)}`
      : undefined,
  scadenzaDa: (f) =>
    f.scadenzaDa || f.scadenzaA
      ? `Scadenza ${fmtDataFiltro(f.scadenzaDa)}–${fmtDataFiltro(f.scadenzaA)}`
      : undefined,
  codScarico: (f) => (f.codScarico ? `Cod. ${f.codScarico}` : undefined),
  lotto: (f) => (f.lotto ? `Lotto ${f.lotto}` : undefined),
  mandato: (f) => (f.mandato ? `Mandato` : undefined),
  sitAffido: (f) =>
    f.sitAffido === "affidata"
      ? "Affidata"
      : f.sitAffido === "non_affidata"
        ? "Non affidata"
        : f.sitAffido === "temporanea"
          ? "Temporanea"
          : undefined,
  affidoProvvisorio: (f) => (f.affidoProvvisorio === "1" ? "Provvisorio" : undefined),
  operatore: (f) => (f.operatore ? `Operatore` : undefined),
  note: (f) => (f.note ? `Note: ${f.note}` : undefined),
  aggiuntivo: (f) => (f.aggiuntivo ? `Agg.: ${f.aggiuntivo}` : undefined),
};

export function describeAltriFiltri(f?: AltriFiltri | null, max = 4): string {
  if (!f || !hasAltriFiltri(f)) return "";
  const parts: string[] = [];
  for (const k of ALTRI_FILTRI_KEYS) {
    const fn = FILTRI_DESCRIZIONI[k];
    const label = fn?.(f);
    if (label) parts.push(label);
    if (parts.length >= max) break;
  }
  if (!parts.length) {
    for (const k of ALTRI_FILTRI_KEYS) {
      if (f[k]) parts.push(String(k));
      if (parts.length >= max) break;
    }
  }
  return parts.join(" · ");
}
