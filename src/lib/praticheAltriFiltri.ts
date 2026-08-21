import type { Prisma } from "@prisma/client";
import { parseDataIso, startOfNextDay } from "@/lib/lavorateOggi";
import { prisma } from "@/lib/prisma";

/**
 * Filtri avanzati coda pratiche (gestione + «Altri filtri»).
 * `aggiuntivo` solo nel modal, non nella griglia principale.
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
  "aggiuntivo",
] as const;

export type AltriFiltriKey = (typeof ALTRI_FILTRI_KEYS)[number];

/** Chiavi mostrate sulla griglia gestione (senza Aggiuntivo). */
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
  /** "1" = solo affidi temporanei / provvisori */
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
  /** Solo modal — elenco da popolare */
  aggiuntivo?: string;
};

function trimOrUndef(v?: string | null) {
  const t = v?.trim();
  return t || undefined;
}

function parseSitAffido(v?: string | null): SitAffidoFiltro | undefined {
  if (v === "affidata" || v === "non_affidata" || v === "temporanea") return v;
  return undefined;
}

function parseNum(v?: string | null): number | undefined {
  const t = trimOrUndef(v);
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Intervallo inclusivo su date (giorno intero). */
function dateRange(da?: string, a?: string): { gte?: Date; lt?: Date } | undefined {
  const from = parseDataIso(da);
  const to = parseDataIso(a);
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lt: startOfNextDay(to) } : {}),
  };
}

function stringRange(da?: string, a?: string): { gte?: string; lte?: string } | undefined {
  const from = trimOrUndef(da);
  const to = trimOrUndef(a);
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

function numRange(da?: string, a?: string): { gte?: number; lte?: number } | undefined {
  const from = parseNum(da);
  const to = parseNum(a);
  if (from == null && to == null) return undefined;
  return {
    ...(from != null ? { gte: from } : {}),
    ...(to != null ? { lte: to } : {}),
  };
}

export function parseAltriFiltri(sp: Record<string, string | null | undefined>): AltriFiltri | undefined {
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
    sitAffido: parseSitAffido(sp.sitAffido),
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
    aggiuntivo: trimOrUndef(sp.aggiuntivo),
  };
  if (!ALTRI_FILTRI_KEYS.some((k) => f[k])) return undefined;
  return f;
}

export function hasAltriFiltri(f?: AltriFiltri | null) {
  return Boolean(f && ALTRI_FILTRI_KEYS.some((k) => f[k]));
}

export function appendAltriFiltriParams(sp: URLSearchParams, f?: AltriFiltri | null) {
  if (!f) return;
  for (const k of ALTRI_FILTRI_KEYS) {
    const v = f[k];
    if (v) sp.set(k, v);
  }
}

export async function idsAffidoTemporaneo(tenantId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM Pratica
    WHERE tenantId = ${tenantId}
      AND assegnatarioId IS NOT NULL
      AND operatoreTitolareId IS NOT NULL
      AND assegnatarioId != operatoreTitolareId
  `;
  return rows.map((r) => r.id);
}

/** Pratiche con (capitale+interessi+spese) nel range. */
export async function idsImportoTotale(
  tenantId: string,
  da?: string,
  a?: string
): Promise<string[] | null> {
  const from = parseNum(da);
  const to = parseNum(a);
  if (from == null && to == null) return null;
  let rows: { id: string }[];
  if (from != null && to != null) {
    rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Pratica
      WHERE tenantId = ${tenantId}
        AND (capitale + interessi + spese) >= ${from}
        AND (capitale + interessi + spese) <= ${to}
    `;
  } else if (from != null) {
    rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Pratica
      WHERE tenantId = ${tenantId}
        AND (capitale + interessi + spese) >= ${from}
    `;
  } else {
    rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Pratica
      WHERE tenantId = ${tenantId}
        AND (capitale + interessi + spese) <= ${to!}
    `;
  }
  return rows.map((r) => r.id);
}

/** Pratiche con SUM(incassi.importo) nel range. */
export async function idsTotIncassato(
  tenantId: string,
  da?: string,
  a?: string
): Promise<string[] | null> {
  const from = parseNum(da);
  const to = parseNum(a);
  if (from == null && to == null) return null;
  let rows: { id: string }[];
  if (from != null && to != null) {
    rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id AS id
      FROM Pratica p
      LEFT JOIN Incasso i ON i.praticaId = p.id
      WHERE p.tenantId = ${tenantId}
      GROUP BY p.id
      HAVING COALESCE(SUM(i.importo), 0) >= ${from}
         AND COALESCE(SUM(i.importo), 0) <= ${to}
    `;
  } else if (from != null) {
    rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id AS id
      FROM Pratica p
      LEFT JOIN Incasso i ON i.praticaId = p.id
      WHERE p.tenantId = ${tenantId}
      GROUP BY p.id
      HAVING COALESCE(SUM(i.importo), 0) >= ${from}
    `;
  } else {
    rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id AS id
      FROM Pratica p
      LEFT JOIN Incasso i ON i.praticaId = p.id
      WHERE p.tenantId = ${tenantId}
      GROUP BY p.id
      HAVING COALESCE(SUM(i.importo), 0) <= ${to!}
    `;
  }
  return rows.map((r) => r.id);
}

export function altriFiltriWhere(
  f: AltriFiltri,
  opts?: {
    canFilterOperatore?: boolean;
    temporaneaIds?: string[];
    importoTotIds?: string[] | null;
    totIncassatoIds?: string[] | null;
  }
): Prisma.PraticaWhereInput {
  const and: Prisma.PraticaWhereInput[] = [];

  if (f.debitore) {
    and.push({
      OR: [
        { debitore: { nome: { contains: f.debitore } } },
        { debitore: { cognome: { contains: f.debitore } } },
      ],
    });
  }

  const cap = stringRange(f.capDa, f.capA);
  if (cap) and.push({ debitore: { cap } });

  if (f.citta) and.push({ debitore: { citta: { contains: f.citta } } });
  if (f.prov) and.push({ debitore: { provincia: { contains: f.prov } } });

  if (f.telefono) {
    and.push({
      OR: [
        { debitore: { telefono: { contains: f.telefono } } },
        { debitore: { recapiti: { some: { valore: { contains: f.telefono } } } } },
        { garanti: { some: { telefono: { contains: f.telefono } } } },
      ],
    });
  }

  const affido = dateRange(f.affidoDa, f.affidoA);
  if (affido) and.push({ dataAffido: affido });

  const scadenza = dateRange(f.scadenzaDa, f.scadenzaA);
  if (scadenza) and.push({ scadenza });

  if (f.mandato) and.push({ mandanteId: f.mandato });
  if (f.lotto) and.push({ numeroMandante: f.lotto });

  if (f.operatore && opts?.canFilterOperatore !== false) {
    and.push({
      OR: [{ assegnatarioId: f.operatore }, { operatoreTitolareId: f.operatore }],
    });
  }

  if (f.codScarico) and.push({ codiceScarico: f.codScarico });

  const wantTemporanea =
    f.sitAffido === "temporanea" || f.affidoProvvisorio === "1";

  if (f.sitAffido === "affidata" && !wantTemporanea) {
    and.push({ assegnatarioId: { not: null } });
  } else if (f.sitAffido === "non_affidata") {
    and.push({ assegnatarioId: null });
  }

  if (wantTemporanea) {
    const ids = opts?.temporaneaIds ?? [];
    and.push({ id: { in: ids.length ? ids : ["__nessuna-temporanea__"] } });
  }

  const rata = numRange(f.importoRataDa, f.importoRataA);
  if (rata) and.push({ rate: { some: { importo: rata } } });

  const residuo = numRange(f.residuoDa, f.residuoA);
  if (residuo) and.push({ residuo });

  if (opts?.importoTotIds) {
    and.push({
      id: {
        in: opts.importoTotIds.length ? opts.importoTotIds : ["__nessun-importo-tot__"],
      },
    });
  }

  if (opts?.totIncassatoIds) {
    and.push({
      id: {
        in: opts.totIncassatoIds.length
          ? opts.totIncassatoIds
          : ["__nessun-tot-incassato__"],
      },
    });
  }

  if (f.cfPiva) {
    and.push({
      OR: [
        { debitore: { codiceFiscale: { contains: f.cfPiva } } },
        { garanti: { some: { codiceFiscale: { contains: f.cfPiva } } } },
      ],
    });
  }

  if (f.garante) {
    and.push({
      OR: [
        { garanti: { some: { nome: { contains: f.garante } } } },
        { garanti: { some: { cognome: { contains: f.garante } } } },
        { garanti: { some: { codiceFiscale: { contains: f.garante } } } },
      ],
    });
  }

  if (f.note) {
    and.push({
      OR: [
        { note: { contains: f.note } },
        { attivita: { some: { nota: { contains: f.note } } } },
      ],
    });
  }

  const nPratica = stringRange(f.nPraticaDa, f.nPraticaA);
  if (nPratica) and.push({ numero: nPratica });

  const prom = dateRange(f.promPagDa, f.promPagA);
  if (prom) and.push({ promessaAt: prom });

  const inc = dateRange(f.incassatoDa, f.incassatoA);
  if (inc) and.push({ incassi: { some: { data: inc } } });

  const memo = dateRange(f.memoDa, f.memoA);
  if (memo) and.push({ memoAt: memo });

  // aggiuntivo: elenco non ancora popolato

  if (!and.length) return {};
  return and.length === 1 ? and[0]! : { AND: and };
}
