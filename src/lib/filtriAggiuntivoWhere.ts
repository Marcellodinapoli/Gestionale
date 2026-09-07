import type { Prisma } from "@prisma/client";
import { parseDataIso, startOfDay, startOfNextDay } from "@/lib/lavorateOggi";
import { isAggiuntivoCampoKey } from "@/lib/filtriAggiuntivoUi";
import { parseTextFilterOp, type TextFilterOp } from "@/lib/filtriTestoOp";
import { prismaTextClause } from "@/lib/filtriTestoWhere";

function applyEqNe(
  cond: Prisma.PraticaWhereInput,
  op?: TextFilterOp | null
): Prisma.PraticaWhereInput {
  return parseTextFilterOp(op) === "ne" ? { NOT: cond } : cond;
}

/** Match testo positivo; la ≠ va applicata con applyEqNe. */
function strMatch(val: string): Prisma.StringFilter {
  return prismaTextClause(val, "eq");
}

function parseNum(val: string): number | undefined {
  const t = val.trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseDateFilter(val: string): Date | null {
  const iso = parseDataIso(val);
  if (iso) return iso;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dateDayRange(val: string) {
  const d = parseDateFilter(val);
  if (!d) return undefined;
  return { gte: startOfDay(d), lt: startOfNextDay(d) };
}

function numMatch(val: string): Prisma.FloatFilter | undefined {
  const n = parseNum(val);
  if (n == null) return undefined;
  return { equals: n };
}

function nominativoWhere(val: string, op?: TextFilterOp | null): Prisma.PraticaWhereInput {
  const parts = val.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const [a, b] = parts;
    const combo: Prisma.PraticaWhereInput[] = [
      {
        debitore: {
          AND: [{ cognome: strMatch(a) }, { nome: strMatch(b) }],
        },
      },
      {
        debitore: {
          AND: [{ cognome: strMatch(b) }, { nome: strMatch(a) }],
        },
      },
    ];
    return applyEqNe({ OR: combo }, op);
  }
  return applyEqNe(
    {
      OR: [
        { debitore: { nome: strMatch(val) } },
        { debitore: { cognome: strMatch(val) } },
      ],
    },
    op
  );
}

function ndgWhere(val: string, op?: TextFilterOp | null): Prisma.PraticaWhereInput {
  return applyEqNe(
    {
      OR: [
        { debitore: { ndg: strMatch(val) } },
        { debitore: { codiceFiscale: strMatch(val) } },
      ],
    },
    op
  );
}

export function aggiuntivoFiltroWhere(
  campo?: string | null,
  valore?: string | null,
  op?: TextFilterOp | null
): Prisma.PraticaWhereInput | undefined {
  const key = campo?.trim();
  const val = valore?.trim();
  if (!key || !val || !isAggiuntivoCampoKey(key)) return undefined;

  switch (key) {
    case "ndg":
      return ndgWhere(val, op);
    case "tipo":
      if (val.toUpperCase() === "DEBITORE" && parseTextFilterOp(op) === "eq") {
        return undefined;
      }
      if (val.toUpperCase() === "DEBITORE" && parseTextFilterOp(op) === "ne") {
        return { id: "__tipo-non-debitore__" };
      }
      return applyEqNe({ id: "__tipo-sconosciuto__" }, op);
    case "nominativo":
      return nominativoWhere(val, op);
    case "indirizzo":
      return applyEqNe({ debitore: { indirizzo: strMatch(val) } }, op);
    case "localita":
      return applyEqNe({ debitore: { citta: strMatch(val) } }, op);
    case "cap":
      return applyEqNe({ debitore: { cap: strMatch(val) } }, op);
    case "provincia":
      return applyEqNe({ debitore: { provincia: strMatch(val) } }, op);
    case "cedente":
      return applyEqNe({ mandante: { ragioneSociale: strMatch(val) } }, op);
    case "contratto":
      return applyEqNe({ numero: strMatch(val) }, op);
    case "societa":
      return applyEqNe({ mandante: { codice: strMatch(val) } }, op);
    case "importo_definito": {
      const n = numMatch(val);
      if (!n) return undefined;
      return applyEqNe({ residuo: n }, op);
    }
    case "fattura_numero":
      return applyEqNe({ fatture: { some: { numero: strMatch(val) } } }, op);
    case "fattura_causale":
      return applyEqNe({ fatture: { some: { causale: strMatch(val) } } }, op);
    case "fattura_data": {
      const range = dateDayRange(val);
      if (!range) return undefined;
      return applyEqNe({ fatture: { some: { dataFattura: range } } }, op);
    }
    case "fattura_scadenza": {
      const range = dateDayRange(val);
      if (!range) return undefined;
      return applyEqNe({ fatture: { some: { dataScadenza: range } } }, op);
    }
    case "fattura_importo": {
      const n = numMatch(val);
      if (!n) return undefined;
      return applyEqNe({ fatture: { some: { importo: n } } }, op);
    }
    case "fattura_pagato": {
      const n = numMatch(val);
      if (!n) return undefined;
      return applyEqNe({ fatture: { some: { pagato: n } } }, op);
    }
    case "incasso_data": {
      const range = dateDayRange(val);
      if (!range) return undefined;
      return applyEqNe({ incassi: { some: { data: range } } }, op);
    }
    case "incasso_metodo":
      return applyEqNe({ incassi: { some: { metodo: strMatch(val) } } }, op);
    case "incasso_modo":
      return applyEqNe({ incassi: { some: { modo: strMatch(val) } } }, op);
    case "incasso_importo": {
      const n = numMatch(val);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { importo: n } } }, op);
    }
    case "incasso_capitale": {
      const n = numMatch(val);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { capitale: n } } }, op);
    }
    case "incasso_interessi": {
      const n = numMatch(val);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { interessi: n } } }, op);
    }
    case "incasso_spese": {
      const n = numMatch(val);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { spese: n } } }, op);
    }
    case "incasso_causale":
      return applyEqNe({ incassi: { some: { causale: strMatch(val) } } }, op);
    case "incasso_operatore":
      return applyEqNe({ incassi: { some: { user: { name: strMatch(val) } } } }, op);
    default:
      return undefined;
  }
}
