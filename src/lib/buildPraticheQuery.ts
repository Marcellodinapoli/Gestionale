import { FILTRO_SRC_PARAM } from "@/lib/filtroVeloceEsclusivo";

export function buildPraticheQuery(params: {
  q?: string;
  stato?: string;
  esito?: string;
  lavorate?: boolean;
  lavorateData?: string;
  lavorateOggi?: boolean;
  nonToccateDa?: 10;
  sort?: string;
  dir?: string;
  page?: number;
  cerca?: string | boolean;
  [key: string]: string | boolean | number | undefined;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", String(params.q));
  if (params.stato) sp.set("stato", String(params.stato));
  if (params.esito) sp.set("esito", String(params.esito));
  if (params.lavorate) sp.set("lavorate", "1");
  if (params.lavorateDa) sp.set("lavorateDa", String(params.lavorateDa));
  if (params.lavorateA) sp.set("lavorateA", String(params.lavorateA));
  if (!params.lavorateDa && !params.lavorateA) {
    if (params.lavorateData) sp.set("lavorateData", String(params.lavorateData));
    else if (params.lavorateOggi) sp.set("lavorateOggi", "1");
  }
  if (params.lavorateFascia) sp.set("lavorateFascia", String(params.lavorateFascia));
  if (params.nonToccateDa) sp.set("nonToccateDa", String(params.nonToccateDa));
  if (params.sort) sp.set("sort", String(params.sort));
  if (params.dir) sp.set("dir", String(params.dir));
  if (params.page && Number(params.page) > 1) sp.set("page", String(params.page));

  if (params.filtroSrc) sp.set(FILTRO_SRC_PARAM, String(params.filtroSrc));

  const altriKeys = [
    "debitore",
    "debitoreOp",
    "capDa",
    "capA",
    "citta",
    "cittaOp",
    "prov",
    "provOp",
    "telefono",
    "telefonoOp",
    "affidoDa",
    "affidoA",
    "scadenzaDa",
    "scadenzaA",
    "scadenzaStragiudizialeDa",
    "scadenzaStragiudizialeA",
    "mandato",
    "mandatoOp",
    "perimetro",
    "perimetroOp",
    "lotto",
    "lottoOp",
    "operatore",
    "operatoreOp",
    "codScarico",
    "codScaricoOp",
    "codScaricoBk",
    "codScaricoBkOp",
    "sitAffido",
    "sitAffidoOp",
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
    "cfPivaOp",
    "garante",
    "garanteOp",
    "note",
    "noteOp",
    "nPraticaDa",
    "nPraticaA",
    "promPagDa",
    "promPagA",
    "incassatoDa",
    "incassatoA",
    "memoDa",
    "memoA",
    "rateScadute",
    "aggiuntivoCampo",
    "aggiuntivoValore",
    "aggiuntivoOp",
    "preavvisoStragiudiziale",
    "attivitaGiudiziale",
  ] as const;
  for (const k of altriKeys) {
    const v = params[k];
    if (v !== undefined && v !== "" && v !== false) sp.set(k, String(v));
  }

  if (params.cerca !== "0" && params.cerca !== false) {
    const hasFiltro = [...sp.keys()].some(
      (k) => k !== "sort" && k !== "dir" && k !== "page" && k !== "cerca"
    );
    if (hasFiltro || params.cerca === "1" || params.cerca === true) {
      sp.set("cerca", "1");
    }
  }

  const qs = sp.toString();
  return qs ? `/pratiche?${qs}` : "/pratiche";
}
