import { hasAggiuntivoFiltro } from "@/lib/filtriAggiuntivoUi";

/** Indica quale form ha applicato l’ultimo filtro (veloce vs tutti i filtri). */
export const FILTRO_SRC_PARAM = "filtroSrc";

export type FiltroSrc = "veloce" | "tutti";

export function parseFiltroSrc(
  sp: Record<string, string | undefined>
): FiltroSrc | null {
  const v = sp[FILTRO_SRC_PARAM]?.trim();
  if (v === "veloce" || v === "tutti") return v;
  return null;
}

/** Campi inviati solo dal form «Tutti i filtri» pratiche (non dalla barra veloce). */
export const PRATICHE_FILTRI_MODAL_ESCLUSIVI = [
  "debitore",
  "capDa",
  "capA",
  "citta",
  "prov",
  "telefono",
  "affidoDa",
  "affidoA",
  "scadenzaDa",
  "scadenzaA",
  "scadenzaStragiudizialeDa",
  "scadenzaStragiudizialeA",
  "mandato",
  "lotto",
  "sitAffido",
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
  "garante",
  "note",
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
] as const;

/** Campi solo barra veloce pratiche (non nel modal). */
export const PRATICHE_FILTRI_VELOCE_ESCLUSIVI = [
  "q",
  "stato",
  "lavorate",
  "lavorateData",
  "lavorateOggi",
  "lavorateDa",
  "lavorateA",
  "lavorateFascia",
  "nonToccateDa",
  "esito",
] as const;

/** Voci riepilogo «altri» mostrate con filtro veloce (campi condivisi). */
export const PRATICHE_VELOCE_ALTRI_VOCE_IDS = new Set([
  "operatore",
  "perimetro",
  "cod-scarico",
  "cod-scarico-bk",
]);

/** Campi solo barra veloce incassi. */
export const INCASSI_FILTRI_VELOCE = ["mandato", "mese", "operatore", "modo"] as const;

/** Campi solo modal incassi (oltre ai 4 condivisi con la barra). */
export const INCASSI_FILTRI_MODAL_ESCLUSIVI = [
  "perimetro",
  "dataDa",
  "dataA",
  "lotto",
  "citta",
  "cliente",
  "affidoDa",
  "affidoA",
  "metodo",
  "ricevuta",
  "causale",
  "capDa",
  "capA",
  "scaricoDa",
  "scaricoA",
] as const;

export function hasPraticheFiltriModalEsclusivi(
  f: Record<string, string | undefined | null> | null | undefined
): boolean {
  if (!f) return false;
  if (
    hasAggiuntivoFiltro(
      f.aggiuntivoCampo ?? undefined,
      f.aggiuntivoValore ?? undefined
    )
  ) {
    return true;
  }
  return PRATICHE_FILTRI_MODAL_ESCLUSIVI.some((k) => {
    const v = f[k];
    return typeof v === "string" ? Boolean(v.trim()) : Boolean(v);
  });
}

export function hasIncassiFiltriModalEsclusivi(
  f: Record<string, string | undefined | null> | null | undefined
): boolean {
  if (!f) return false;
  return INCASSI_FILTRI_MODAL_ESCLUSIVI.some((k) => {
    const v = f[k];
    return typeof v === "string" ? Boolean(v.trim()) : Boolean(v);
  });
}

/** Evidenzia «Tutti i filtri» solo se l’ultimo submit è stato dal modal. */
export function tuttiFiltriPraticheAttivi(
  sp: Record<string, string | undefined>,
  altri: Record<string, string | undefined | null> | null | undefined
): boolean {
  const src = parseFiltroSrc(sp);
  if (src === "veloce") return false;
  if (src === "tutti") return true;
  return hasPraticheFiltriModalEsclusivi(altri);
}

export function tuttiFiltriIncassiAttivi(
  sp: Record<string, string | undefined>,
  filtri: Record<string, string | undefined | null> | null | undefined
): boolean {
  const src = parseFiltroSrc(sp);
  if (src === "veloce") return false;
  if (src === "tutti") return true;
  return hasIncassiFiltriModalEsclusivi(filtri);
}
