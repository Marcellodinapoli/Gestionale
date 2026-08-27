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
  hasAltriFiltri,
  parseAltriFiltri,
  type AltriFiltri,
} from "@/lib/praticheAltriFiltriUi";
import type { CodaFiltro as CodaFiltroBase } from "@/lib/praticaCodaNav";

export {
  buildPraticaCodaHref,
  buildPraticheListaHref,
  codaFiltroSearchParams,
  codaNavSearchParams,
  parseCodaPageIds,
} from "@/lib/praticaCodaNav";

export type CodaFiltro = CodaFiltroBase & {
  lavorateFascia?: LavorateFascia;
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
