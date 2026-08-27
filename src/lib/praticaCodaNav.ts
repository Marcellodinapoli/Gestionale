/**
 * Helper navigazione coda pratiche — sicuri per Client Component (niente Prisma).
 */
import {
  appendAltriFiltriParams,
  type AltriFiltri,
} from "@/lib/praticheAltriFiltriUi";

export type CodaFiltro = {
  q?: string;
  stato?: string;
  esito?: string;
  lavorate?: boolean;
  lavorateData?: string;
  lavorateDa?: string;
  lavorateA?: string;
  lavorateOggi?: boolean;
  lavorateFascia?: string;
  nonToccateDa?: number;
  altri?: AltriFiltri;
};

export type CodaNav = {
  filtro?: CodaFiltro;
  sort: string;
  dir: "asc" | "desc";
  listPage: number;
};

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

export function codaNavSearchParams(nav: CodaNav) {
  const sp = nav.filtro
    ? codaFiltroSearchParams(nav.filtro)
    : new URLSearchParams();
  sp.set("sort", nav.sort);
  sp.set("dir", nav.dir);
  if (nav.listPage > 1) sp.set("page", String(nav.listPage));
  return sp;
}

export function buildPraticheListaHref(nav?: CodaNav) {
  if (!nav) return "/pratiche";
  const q = codaNavSearchParams(nav).toString();
  return q ? `/pratiche?${q}` : "/pratiche";
}

export function buildPraticaCodaHref(
  id: string,
  nav?: CodaNav,
  pageIds?: string[]
) {
  if (!nav && !pageIds?.length) return `/pratiche/${id}`;
  const sp = nav ? codaNavSearchParams(nav) : new URLSearchParams();
  if (pageIds?.length) {
    const capped = pageIds.slice(0, 50);
    if (capped.length) sp.set("ids", capped.join(","));
  }
  const qs = sp.toString();
  return qs ? `/pratiche/${id}?${qs}` : `/pratiche/${id}`;
}

export function parseCodaPageIds(raw?: string | null): string[] | null {
  if (!raw?.trim()) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  return ids.length ? ids : null;
}
