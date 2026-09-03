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

function strClause(val: string, op?: TextFilterOp | null): Prisma.StringFilter {
  return prismaTextClause(val, op);
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

function numClause(val: string, op?: TextFilterOp | null): Prisma.FloatFilter | undefined {
  const n = parseNum(val);
  if (n == null) return undefined;
  if (parseTextFilterOp(op) === "ne") return { not: n };
  return { equals: n };
}

function nominativoWhere(val: string, op?: TextFilterOp | null): Prisma.PraticaWhereInput {
  const parts = val.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const [a, b] = parts;
    const combo: Prisma.PraticaWhereInput[] = [
      {
        debitore: {
          AND: [{ cognome: strClause(a, op) }, { nome: strClause(b, op) }],
        },
      },
      {
        debitore: {
          AND: [{ cognome: strClause(b, op) }, { nome: strClause(a, op) }],
        },
      },
    ];
    return applyEqNe({ OR: combo }, op);
  }
  return applyEqNe(
    {
      OR: [
        { debitore: { nome: strClause(val, op) } },
        { debitore: { cognome: strClause(val, op) } },
      ],
    },
    op
  );
}

function ndgWhere(val: string, op?: TextFilterOp | null): Prisma.PraticaWhereInput {
  return applyEqNe(
    {
      OR: [
        { debitore: { ndg: strClause(val, op) } },
        { debitore: { codiceFiscale: strClause(val, op) } },
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
      return applyEqNe({ debitore: { indirizzo: strClause(val, op) } }, op);
    case "localita":
      return applyEqNe({ debitore: { citta: strClause(val, op) } }, op);
    case "cap":
      return applyEqNe({ debitore: { cap: strClause(val, op) } }, op);
    case "provincia":
      return applyEqNe({ debitore: { provincia: strClause(val, op) } }, op);
    case "cedente":
      return applyEqNe({ mandante: { ragioneSociale: strClause(val, op) } }, op);
    case "contratto":
      return applyEqNe({ numero: strClause(val, op) }, op);
    case "societa":
      return applyEqNe({ mandante: { codice: strClause(val, op) } }, op);
    case "importo_definito": {
      const n = numClause(val, op);
      if (!n) return undefined;
      return applyEqNe({ residuo: n }, op);
    }
    case "fattura_numero":
      return applyEqNe({ fatture: { some: { numero: strClause(val, op) } } }, op);
    case "fattura_causale":
      return applyEqNe({ fatture: { some: { causale: strClause(val, op) } } }, op);
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
      const n = numClause(val, op);
      if (!n) return undefined;
      return applyEqNe({ fatture: { some: { importo: n } } }, op);
    }
    case "fattura_pagato": {
      const n = numClause(val, op);
      if (!n) return undefined;
      return applyEqNe({ fatture: { some: { pagato: n } } }, op);
    }
    case "incasso_data": {
      const range = dateDayRange(val);
      if (!range) return undefined;
      return applyEqNe({ incassi: { some: { data: range } } }, op);
    }
    case "incasso_metodo":
      return applyEqNe({ incassi: { some: { metodo: strClause(val, op) } } }, op);
    case "incasso_modo":
      return applyEqNe({ incassi: { some: { modo: strClause(val, op) } } }, op);
    case "incasso_importo": {
      const n = numClause(val, op);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { importo: n } } }, op);
    }
    case "incasso_capitale": {
      const n = numClause(val, op);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { capitale: n } } }, op);
    }
    case "incasso_interessi": {
      const n = numClause(val, op);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { interessi: n } } }, op);
    }
    case "incasso_spese": {
      const n = numClause(val, op);
      if (!n) return undefined;
      return applyEqNe({ incassi: { some: { spese: n } } }, op);
    }
    case "incasso_causale":
      return applyEqNe({ incassi: { some: { causale: strClause(val, op) } } }, op);
    case "incasso_operatore":
      return applyEqNe({ incassi: { some: { user: { name: strClause(val, op) } } } }, op);
    default:
      return undefined;
  }
}
