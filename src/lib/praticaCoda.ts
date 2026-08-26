import type { Prisma } from "@prisma/client";
import {
  formatDataIso,
  intervalloFasciaOraria,
  intervalloGiornata,
  parseDataIso,
  parseLavorateFascia,
  resolveLavorateGiorno,
  startOfDay,
  startOfNextDay,
  startOfToday,
  type LavorateFascia,
} from "@/lib/lavorateOggiUi";
import {
  parseNonToccateDa,
  praticheNonToccateWhere,
  type NonToccateDa,
} from "@/lib/praticheInattive";
import {
  attivitaLavorazioneWhere,
  parseDir,
  parseSort,
  type SortDir,
  type SortField,
} from "@/lib/praticaOrdine";
import {
  appendAltriFiltriParams,
  hasAltriFiltri,
  parseAltriFiltri,
  type AltriFiltri,
} from "@/lib/praticheAltriFiltriUi";

export type CodaFiltro = {
  q?: string;
  stato?: string;
  esito?: string;
  lavorate?: boolean;
  /** YYYY-MM-DD — legacy: singolo giorno (equivale a da = a) */
  lavorateData?: string;
  /** YYYY-MM-DD — inizio intervallo lavorazioni */
  lavorateDa?: string;
  /** YYYY-MM-DD — fine intervallo lavorazioni */
  lavorateA?: string;
  /** Alias legacy: equivale al giorno corrente */
  lavorateOggi?: boolean;
  /** Mattina 09:00–13:30 / pomeriggio 13:31–19:00 (solo se intervallo di un solo giorno) */
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
  let lavorateDa = sp.lavorateDa?.trim() || undefined;
  let lavorateA = sp.lavorateA?.trim() || undefined;
  // Legacy: un solo giorno via lavorateData
  if (!lavorateDa && !lavorateA && lavorateData) {
    lavorateDa = lavorateData;
    lavorateA = lavorateData;
  }
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
    !lavorateDa &&
    !lavorateA &&
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
    lavorateDa,
    lavorateA,
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
      sp.lavorateDa?.trim() ||
      sp.lavorateA?.trim() ||
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

  const fascia = filtro.lavorateFascia;
  // Filtra sull'ultima lavorazione (op/sup): solo Da → ultima ≥ Da; solo Al → ultima ≤ Al.
  const da = parseDataIso(filtro.lavorateDa);
  const a = parseDataIso(filtro.lavorateA);
  const andExtra: Prisma.PraticaWhereInput[] = [];

  if (da || a) {
    const stessoGiorno = da && a && formatDataIso(da) === formatDataIso(a);
    if (fascia && stessoGiorno && da) {
      const { gte, lt } = intervalloFasciaOraria(da, fascia);
      extra.attivita = {
        some: { ...attivitaLavorazioneWhere, createdAt: { gte, lt } },
      };
      andExtra.push({
        NOT: {
          attivita: {
            some: { ...attivitaLavorazioneWhere, createdAt: { gte: lt } },
          },
        },
      });
    } else {
      // Ultima ≥ Da ⇔ esiste evento ≥ Da; ultima ≤ Al ⇔ nessun evento dopo Al.
      if (da) {
        extra.attivita = {
          some: {
            ...attivitaLavorazioneWhere,
            createdAt: { gte: startOfDay(da) },
          },
        };
      } else {
        extra.attivita = {
          some: {
            ...attivitaLavorazioneWhere,
            createdAt: { lt: startOfNextDay(a!) },
          },
        };
      }
      if (a) {
        andExtra.push({
          NOT: {
            attivita: {
              some: {
                ...attivitaLavorazioneWhere,
                createdAt: { gte: startOfNextDay(a) },
              },
            },
          },
        });
      }
    }
  } else if (fascia) {
    const giornoFascia = resolveLavorateGiorno(filtro) ?? startOfToday();
    const { gte, lt } = intervalloFasciaOraria(giornoFascia, fascia);
    extra.attivita = {
      some: { ...attivitaLavorazioneWhere, createdAt: { gte, lt } },
    };
  } else {
    const giorno = resolveLavorateGiorno(filtro);
    if (giorno) {
      const { gte, lt } = intervalloGiornata(giorno);
      extra.attivita = {
        some: { ...attivitaLavorazioneWhere, createdAt: { gte, lt } },
      };
    }
  }

  if (filtro.nonToccateDa) {
    Object.assign(extra, praticheNonToccateWhere(filtro.nonToccateDa));
  }
  if (andExtra.length) {
    const prev = extra.AND;
    extra.AND = [
      ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
      ...andExtra,
    ];
  }
  if (filtro.q) {
    const q = filtro.q;
    extra.OR = [
      { numero: { contains: q } },
      { numeroMandante: { contains: q } },
      { note: { contains: q } },
      { mandante: { codice: { contains: q } } },
      { mandante: { ragioneSociale: { contains: q } } },
      { fatture: { some: { numero: { contains: q } } } },
      { fatture: { some: { causale: { contains: q } } } },
      { incassi: { some: { causale: { contains: q } } } },
      { incassi: { some: { modo: { contains: q } } } },
      { incassi: { some: { metodo: { contains: q } } } },
      { debitore: { nome: { contains: q } } },
      { debitore: { cognome: { contains: q } } },
      { debitore: { telefono: { contains: q } } },
      { debitore: { email: { contains: q } } },
      { debitore: { codiceFiscale: { contains: q } } },
      { debitore: { ndg: { contains: q } } },
      { debitore: { indirizzo: { contains: q } } },
      { debitore: { citta: { contains: q } } },
      { debitore: { cap: { contains: q } } },
      { debitore: { provincia: { contains: q } } },
      { debitore: { recapiti: { some: { valore: { contains: q } } } } },
      { garanti: { some: { nome: { contains: q } } } },
      { garanti: { some: { cognome: { contains: q } } } },
      { garanti: { some: { telefono: { contains: q } } } },
      { garanti: { some: { email: { contains: q } } } },
      { garanti: { some: { codiceFiscale: { contains: q } } } },
      { garanti: { some: { indirizzo: { contains: q } } } },
      { garanti: { some: { citta: { contains: q } } } },
      { garanti: { some: { cap: { contains: q } } } },
      { garanti: { some: { provincia: { contains: q } } } },
      { garanti: { some: { recapiti: { some: { valore: { contains: q } } } } } },
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

/** Elenco pratiche con gli stessi filtri/ordinamento della coda corrente. */
export function buildPraticheListaHref(nav?: CodaNav) {
  if (!nav) return "/pratiche";
  const q = codaNavSearchParams(nav).toString();
  return q ? `/pratiche?${q}` : "/pratiche";
}

export function codaFiltroSearchParams(filtro: CodaFiltro) {
  const sp = new URLSearchParams();
  if (filtro.q) sp.set("q", filtro.q);
  if (filtro.stato) sp.set("stato", filtro.stato);
  if (filtro.esito) sp.set("esito", filtro.esito);
  if (filtro.lavorate) sp.set("lavorate", "1");
  if (filtro.lavorateDa) sp.set("lavorateDa", filtro.lavorateDa);
  if (filtro.lavorateA) sp.set("lavorateA", filtro.lavorateA);
  if (!filtro.lavorateDa && !filtro.lavorateA) {
    if (filtro.lavorateData) sp.set("lavorateData", filtro.lavorateData);
    else if (filtro.lavorateOggi) sp.set("lavorateOggi", "1");
  }
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
