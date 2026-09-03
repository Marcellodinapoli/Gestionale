import type { Prisma } from "@prisma/client";
import { parseDataIso, startOfDay, startOfNextDay } from "@/lib/lavorateOggi";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser, idsAffidoTemporaneoForTenant, idsImportoTotaleForTenant, idsTotIncassatoForTenant, type PraticaDbContext } from "@/lib/praticheRepo";
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
import { parseCodScaricoOp, parseCodScaricoList } from "@/lib/filtriCodScarico";
import { parseOperatoreOp, parseOperatoreList } from "@/lib/filtriOperatore";
import { parseTextFilterOp } from "@/lib/filtriTestoOp";
import { prismaContainsClause } from "@/lib/filtriTestoWhere";
import { parsePerimetri, perimetroPerNome } from "@/lib/mandantePerimetri";
import { aggiuntivoFiltroWhere } from "@/lib/filtriAggiuntivoWhere";
import { hasAggiuntivoFiltro } from "@/lib/filtriAggiuntivoUi";
import type { MandantePerimetriRef } from "@/lib/filtriCodScaricoPerimetro";

function applyEqNe(
  cond: Prisma.PraticaWhereInput,
  op?: string | null
): Prisma.PraticaWhereInput {
  return parseTextFilterOp(op) === "ne" ? { NOT: cond } : cond;
}

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

export async function idsAffidoTemporaneo(ctx: PraticaDbContext): Promise<string[]> {
  return idsAffidoTemporaneoForTenant(ctx);
}

/** Pratiche con (capitale+interessi+spese) nel range — SQL-side in connector mode. */
export async function idsImportoTotale(
  ctx: PraticaDbContext,
  da?: string,
  a?: string
): Promise<string[] | null> {
  const from = parseNum(da);
  const to = parseNum(a);
  if (from == null && to == null) return null;
  return idsImportoTotaleForTenant(ctx, from ?? undefined, to ?? undefined);
}

/** Pratiche con tot incassato nel range — SQL-side in connector mode. */
export async function idsTotIncassato(
  ctx: PraticaDbContext,
  da?: string,
  a?: string
): Promise<string[] | null> {
  const from = parseNum(da);
  const to = parseNum(a);
  if (from == null && to == null) return null;
  return idsTotIncassatoForTenant(ctx, from ?? undefined, to ?? undefined);
}

function chiaviPerimetroFiltro(
  perimetriRaw: string | null | undefined,
  selected: string
): string[] {
  const key = selected.trim();
  if (!key) return [];
  const elenco = parsePerimetri(perimetriRaw);
  const hit =
    perimetroPerNome(elenco, key) ??
    elenco.find((p) => p.descrizione.trim() === key) ??
    elenco.find((p) => p.nomeInterno.trim() === key) ??
    null;
  if (!hit) return [key];
  return [
    ...new Set(
      [key, hit.nomeMandante.trim(), hit.descrizione.trim(), hit.nomeInterno.trim()].filter(
        Boolean
      )
    ),
  ];
}

function chiaviPerimetroFiltroTenant(
  mandanti: MandantePerimetriRef[] | undefined,
  selected: string,
  mandatoId?: string | null
): string[] {
  const list = mandatoId
    ? (mandanti || []).filter((m) => m.id === mandatoId)
    : mandanti || [];
  const keys = new Set<string>();
  for (const m of list) {
    for (const k of chiaviPerimetroFiltro(m.perimetri, selected)) keys.add(k);
  }
  if (!keys.size) keys.add(selected.trim());
  return [...keys];
}

export function altriFiltriWhere(
  f: AltriFiltri,
  opts?: {
    canFilterOperatore?: boolean;
    temporaneaIds?: string[];
    importoTotIds?: string[] | null;
    totIncassatoIds?: string[] | null;
    mandantiPerimetri?: MandantePerimetriRef[];
  }
): Prisma.PraticaWhereInput {
  const and: Prisma.PraticaWhereInput[] = [];

  if (f.debitore) {
    const val = f.debitore;
    const op = parseTextFilterOp(f.debitoreOp);
    const matchNome = { debitore: { nome: prismaContainsClause(val, op) } };
    const matchCognome = { debitore: { cognome: prismaContainsClause(val, op) } };
    if (op === "ne") {
      and.push({ NOT: { OR: [matchNome, matchCognome] } });
    } else {
      and.push({ OR: [matchNome, matchCognome] });
    }
  }

  const cap = stringRange(f.capDa, f.capA);
  if (cap) and.push({ debitore: { cap } });

  if (f.citta) {
    and.push({
      debitore: { citta: prismaContainsClause(f.citta, f.cittaOp) },
    });
  }
  if (f.prov) {
    and.push({
      debitore: { provincia: prismaContainsClause(f.prov, f.provOp) },
    });
  }

  if (f.telefono) {
    const val = f.telefono;
    const op = parseTextFilterOp(f.telefonoOp);
    const paths = [
      { debitore: { telefono: prismaContainsClause(val, op) } },
      { debitore: { recapiti: { some: { valore: prismaContainsClause(val, op) } } } },
      { garanti: { some: { telefono: prismaContainsClause(val, op) } } },
    ];
    if (op === "ne") and.push({ NOT: { OR: paths } });
    else and.push({ OR: paths });
  }

  const affido = dateRange(f.affidoDa, f.affidoA);
  if (affido) and.push({ dataAffido: affido });

  const scadenza = dateRange(f.scadenzaDa, f.scadenzaA);
  if (scadenza) and.push({ scadenza });

  if (f.mandato) {
    and.push(applyEqNe({ mandanteId: f.mandato }, f.mandatoOp));
  }
  if (f.perimetro) {
    const keys = chiaviPerimetroFiltroTenant(
      opts?.mandantiPerimetri,
      f.perimetro,
      f.mandato
    );
    const paths: Prisma.PraticaWhereInput[] = [];
    for (const k of keys) {
      paths.push({ importBatch: { is: { perimetro: k } } });
      paths.push({ numeroMandante: k });
    }
    and.push(applyEqNe({ OR: paths }, f.perimetroOp));
  }
  if (f.lotto) {
    and.push(applyEqNe({ numeroMandante: f.lotto }, f.lottoOp));
  }

  if (f.operatore && opts?.canFilterOperatore !== false) {
    const ids = parseOperatoreList(f.operatore);
    if (ids.length) {
      const op = parseOperatoreOp(f.operatoreOp);
      const matchAny = {
        OR: [{ assegnatarioId: { in: ids } }, { operatoreTitolareId: { in: ids } }],
      };
      if (op === "ne") {
        and.push({ NOT: matchAny });
      } else {
        and.push(matchAny);
      }
    }
  }

  if (f.codScarico) {
    const codes = parseCodScaricoList(f.codScarico);
    if (codes.length) {
      const op = parseCodScaricoOp(f.codScaricoOp);
      if (op === "ne") {
        and.push({ codiceScarico: { notIn: codes } });
      } else if (codes.length === 1) {
        and.push({ codiceScarico: codes[0]! });
      } else {
        and.push({ codiceScarico: { in: codes } });
      }
    }
  }

  const wantTemporanea =
    f.sitAffido === "temporanea" || f.affidoProvvisorio === "1";

  if (f.sitAffido === "affidata" && !wantTemporanea) {
    and.push(applyEqNe({ assegnatarioId: { not: null } }, f.sitAffidoOp));
  } else if (f.sitAffido === "non_affidata") {
    and.push(applyEqNe({ assegnatarioId: null }, f.sitAffidoOp));
  }

  if (wantTemporanea) {
    const ids = opts?.temporaneaIds ?? [];
    const temporaneaCond: Prisma.PraticaWhereInput = {
      id: { in: ids.length ? ids : ["__nessuna-temporanea__"] },
    };
    if (f.sitAffido === "temporanea") {
      and.push(applyEqNe(temporaneaCond, f.sitAffidoOp));
    } else {
      and.push(temporaneaCond);
    }
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
    const val = f.cfPiva;
    const op = parseTextFilterOp(f.cfPivaOp);
    const paths = [
      { debitore: { codiceFiscale: prismaContainsClause(val, op) } },
      { garanti: { some: { codiceFiscale: prismaContainsClause(val, op) } } },
    ];
    if (op === "ne") and.push({ NOT: { OR: paths } });
    else and.push({ OR: paths });
  }

  if (f.garante) {
    const val = f.garante;
    const op = parseTextFilterOp(f.garanteOp);
    const paths = [
      { garanti: { some: { nome: prismaContainsClause(val, op) } } },
      { garanti: { some: { cognome: prismaContainsClause(val, op) } } },
      { garanti: { some: { codiceFiscale: prismaContainsClause(val, op) } } },
    ];
    if (op === "ne") and.push({ NOT: { OR: paths } });
    else and.push({ OR: paths });
  }

  if (f.note) {
    const val = f.note;
    const op = parseTextFilterOp(f.noteOp);
    const paths = [
      { note: prismaContainsClause(val, op) },
      { attivita: { some: { nota: prismaContainsClause(val, op) } } },
    ];
    if (op === "ne") and.push({ NOT: { OR: paths } });
    else and.push({ OR: paths });
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

  const aggiuntivo = aggiuntivoFiltroWhere(
    f.aggiuntivoCampo,
    f.aggiuntivoValore,
    f.aggiuntivoOp
  );
  if (aggiuntivo && hasAggiuntivoFiltro(f.aggiuntivoCampo, f.aggiuntivoValore)) {
    and.push(aggiuntivo);
  }

  if (!and.length) return {};
  return and.length === 1 ? and[0]! : { AND: and };
}
