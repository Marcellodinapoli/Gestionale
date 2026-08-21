import type { Prisma } from "@prisma/client";
import {
  intervalloFasciaOraria,
  intervalloGiornata,
  parseLavorateFascia,
  resolveLavorateGiorno,
  startOfToday,
  type LavorateFascia,
} from "@/lib/lavorateOggi";
import {
  parseNonToccateDa,
  praticheNonToccateWhere,
  type NonToccateDa,
} from "@/lib/praticheInattive";
import { parseDir, parseSort, type SortDir, type SortField } from "@/lib/praticaOrdine";
import {
  appendAltriFiltriParams,
  hasAltriFiltri,
  parseAltriFiltri,
  type AltriFiltri,
} from "@/lib/praticheAltriFiltri";

export type CodaFiltro = {
  q?: string;
  stato?: string;
  esito?: string;
  lavorate?: boolean;
  /** YYYY-MM-DD — pratiche con attività in quel giorno */
  lavorateData?: string;
  /** Alias legacy: equivale al giorno corrente */
  lavorateOggi?: boolean;
  /** Mattina 09–13 / pomeriggio 13:05–18 */
  lavorateFascia?: LavorateFascia;
  /** Pratiche aperte senza aggiornamenti da almeno N giorni */
  nonToccateDa?: NonToccateDa;
  altri?: AltriFiltri;
};

/** Contesto elenco pratiche: filtri, ordinamento e pagina lista corrente. */
export type CodaNav = {
  filtro?: CodaFiltro;
  sort: SortField;
  dir: SortDir;
  listPage: number;
};

type SpLike = Record<string, string | null | undefined>;

export function parseCodaFiltro(sp: SpLike): CodaFiltro | undefined {
  const q = sp.q?.trim() || undefined;
  const stato = sp.stato?.trim() || undefined;
  const esito = sp.esito?.trim() || undefined;
  const lavorate = sp.lavorate === "1";
  const lavorateData = sp.lavorateData?.trim() || undefined;
  const lavorateOggi = sp.lavorateOggi === "1";
  const lavorateFascia = parseLavorateFascia(sp.lavorateFascia);
  const nonToccateDa = parseNonToccateDa(sp.nonToccateDa);
  const altri = parseAltriFiltri(sp);
  if (
    !q &&
    !stato &&
    !esito &&
    !lavorate &&
    !lavorateOggi &&
    !lavorateData &&
    !lavorateFascia &&
    !nonToccateDa &&
    !altri
  ) {
    return undefined;
  }
  return {
    q,
    stato,
    esito,
    lavorate,
    lavorateData,
    lavorateOggi,
    lavorateFascia,
    nonToccateDa,
    altri,
  };
}

export function hasCodaNavParams(sp: SpLike) {
  return Boolean(
    sp.q?.trim() ||
      sp.stato?.trim() ||
      sp.esito?.trim() ||
      sp.lavorate === "1" ||
      sp.lavorateOggi === "1" ||
      sp.lavorateData?.trim() ||
      parseLavorateFascia(sp.lavorateFascia) ||
      sp.nonToccateDa ||
      hasAltriFiltri(parseAltriFiltri(sp)) ||
      sp.sort ||
      sp.dir ||
      (sp.page && sp.page !== "1")
  );
}

export function parseCodaNav(sp: SpLike): CodaNav {
  const sort = parseSort(sp.sort);
  return {
    filtro: parseCodaFiltro(sp),
    sort,
    dir: parseDir(sp.dir, sort),
    listPage: Math.max(1, Number(sp.page) || 1),
  };
}

export function codaFiltroWhere(filtro: CodaFiltro): Prisma.PraticaWhereInput {
  const extra: Prisma.PraticaWhereInput = {};
  if (filtro.stato) extra.stato = filtro.stato;
  if (filtro.esito) extra.esitoContatto = filtro.esito;
  if (filtro.lavorate) extra.attivita = { some: {} };

  const giorno = resolveLavorateGiorno(filtro);
  const fascia = filtro.lavorateFascia;
  if (fascia) {
    const giornoFascia = giorno ?? startOfToday();
    const { gte, lt } = intervalloFasciaOraria(giornoFascia, fascia);
    extra.attivita = { some: { createdAt: { gte, lt } } };
  } else if (giorno) {
    const { gte, lt } = intervalloGiornata(giorno);
    extra.attivita = { some: { createdAt: { gte, lt } } };
  }

  if (filtro.nonToccateDa) {
    Object.assign(extra, praticheNonToccateWhere(filtro.nonToccateDa));
  }
  if (filtro.q) {
    extra.OR = [
      { numero: { contains: filtro.q } },
      { debitore: { nome: { contains: filtro.q } } },
      { debitore: { cognome: { contains: filtro.q } } },
      { debitore: { telefono: { contains: filtro.q } } },
      { debitore: { recapiti: { some: { valore: { contains: filtro.q } } } } },
      { debitore: { email: { contains: filtro.q } } },
      { garanti: { some: { telefono: { contains: filtro.q } } } },
      { garanti: { some: { email: { contains: filtro.q } } } },
      { garanti: { some: { recapiti: { some: { valore: { contains: filtro.q } } } } } },
    ];
  }
  return extra;
}

export function codaNavSearchParams(nav: CodaNav) {
  const sp = nav.filtro ? codaFiltroSearchParams(nav.filtro) : new URLSearchParams();
  sp.set("sort", nav.sort);
  sp.set("dir", nav.dir);
  if (nav.listPage > 1) sp.set("page", String(nav.listPage));
  return sp;
}

export function codaFiltroSearchParams(filtro: CodaFiltro) {
  const sp = new URLSearchParams();
  if (filtro.q) sp.set("q", filtro.q);
  if (filtro.stato) sp.set("stato", filtro.stato);
  if (filtro.esito) sp.set("esito", filtro.esito);
  if (filtro.lavorate) sp.set("lavorate", "1");
  if (filtro.lavorateData) sp.set("lavorateData", filtro.lavorateData);
  else if (filtro.lavorateOggi) sp.set("lavorateOggi", "1");
  if (filtro.lavorateFascia) sp.set("lavorateFascia", filtro.lavorateFascia);
  if (filtro.nonToccateDa) sp.set("nonToccateDa", String(filtro.nonToccateDa));
  appendAltriFiltriParams(sp, filtro.altri);
  return sp;
}

export function buildPraticaCodaHref(id: string, nav?: CodaNav) {
  if (!nav) return `/pratiche/${id}`;
  const qs = codaNavSearchParams(nav).toString();
  return `/pratiche/${id}?${qs}`;
}
