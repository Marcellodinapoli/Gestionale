import type { Prisma } from "@prisma/client";
import { parseDataIso, startOfDay, startOfNextDay } from "@/lib/lavorateOggi";
import { prisma } from "@/lib/prisma";
import { rateScaduteSomeWhere } from "@/lib/rate";
export {
  ALTRI_FILTRI_KEYS,
  FILTRI_GESTIONE_KEYS,
  parseAltriFiltri,
  hasAltriFiltri,
  describeAltriFiltri,
  sanitizeAltriFiltri,
  appendAltriFiltriParams,
  type AltriFiltri,
  type AltriFiltriKey,
  type SitAffidoFiltro,
} from "@/lib/praticheAltriFiltriUi";
import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";

function trimOrUndef(v?: string | null) {
  const t = v?.trim();
  return t || undefined;
}

function parseNum(v?: string | null): number | undefined {
  const t = trimOrUndef(v);
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Intervallo date inclusivo, anche con una sola estremità:
 * — solo Da → da quella data in poi
 * — solo Al → fino a quella data
 * — entrambe → intervallo chiuso
 */
function dateRange(da?: string, a?: string): { gte?: Date; lt?: Date } | undefined {
  const from = parseDataIso(da);
  const to = parseDataIso(a);
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: startOfDay(from) } : {}),
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

export async function idsAffidoTemporaneo(tenantId: string): Promise<string[]> {
  const rows = await prisma.pratica.findMany({
    where: {
      tenantId,
      assegnatarioId: { not: null },
      operatoreTitolareId: { not: null },
    },
    select: { id: true, assegnatarioId: true, operatoreTitolareId: true },
  });
  return rows
    .filter((r) => r.assegnatarioId && r.operatoreTitolareId && r.assegnatarioId !== r.operatoreTitolareId)
    .map((r) => r.id);
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
  const rows = await prisma.pratica.findMany({
    where: { tenantId },
    select: { id: true, capitale: true, interessi: true, spese: true },
  });
  return rows
    .filter((r) => {
      const tot = (r.capitale || 0) + (r.interessi || 0) + (r.spese || 0);
      if (from != null && tot < from) return false;
      if (to != null && tot > to) return false;
      return true;
    })
    .map((r) => r.id);
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
  const pratiche = await prisma.pratica.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const incassi = await prisma.incasso.findMany({
    where: { pratica: { tenantId } },
    select: { praticaId: true, importo: true },
  });
  const sumBy = new Map<string, number>();
  for (const i of incassi) {
    sumBy.set(i.praticaId, (sumBy.get(i.praticaId) || 0) + (i.importo || 0));
  }
  return pratiche
    .filter((p) => {
      const tot = sumBy.get(p.id) || 0;
      if (from != null && tot < from) return false;
      if (to != null && tot > to) return false;
      return true;
    })
    .map((p) => p.id);
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

  if (f.rateScadute === "1" || f.rateScadute === "0") {
    const rateScaduteSome = rateScaduteSomeWhere();
    if (f.rateScadute === "1") and.push(rateScaduteSome);
    else and.push({ NOT: rateScaduteSome });
  }

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

  // Data promessa di pagamento (promessaAt): stessa logica dal/al delle lavorazioni.
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
