import { buildPraticheQuery } from "@/lib/buildPraticheQuery";
import { formatDataIso } from "@/lib/lavorateOggi";

/** Allineato al conteggio «Pratiche affidate» in Home (scope operatore). */
export function hrefPraticheAffidateHome() {
  return buildPraticheQuery({ stato: "TUTTI" });
}

/** Mandato scaduto, pratica aperta (stato operativo SCADUTA). */
export function hrefPraticheScaduteHome() {
  return buildPraticheQuery({ stato: "SCADUTA" });
}

/** In lavorazione operativa (affidata, mandato non scaduto). */
export function hrefPraticheInLavorazioneHome() {
  return buildPraticheQuery({ stato: "IN_LAVORAZIONE" });
}

/** Scadenza mandato da oggi a oggi+7 (come KPI Home). */
export function hrefPraticheInScadenza7ggHome(now = new Date()) {
  const oggi = new Date(now);
  oggi.setHours(0, 0, 0, 0);
  const tra7 = new Date(oggi);
  tra7.setDate(tra7.getDate() + 7);
  return buildPraticheQuery({
    scadenzaDa: formatDataIso(oggi),
    scadenzaA: formatDataIso(tra7),
  });
}
