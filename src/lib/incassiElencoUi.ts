/** Tipi e helper filtri elenco incassi — safe per client (URL / UI). */

export type IncassiElencoFiltri = {
  mandato?: string;
  perimetro?: string;
  operatore?: string;
  modo?: string;
  mese?: string;
  dataDa?: string;
  dataA?: string;
  lotto?: string;
  citta?: string;
  cliente?: string;
  affidoDa?: string;
  affidoA?: string;
  metodo?: string;
  ricevuta?: string;
  causale?: string;
  capDa?: string;
  capA?: string;
  scaricoDa?: string;
  scaricoA?: string;
};

export function parseIncassiElencoFiltri(
  sp: Record<string, string | undefined>
): IncassiElencoFiltri {
  const pick = (k: keyof IncassiElencoFiltri) => {
    const v = sp[k]?.trim();
    return v || undefined;
  };
  return {
    mandato: pick("mandato"),
    perimetro: pick("perimetro"),
    operatore: pick("operatore"),
    modo: pick("modo"),
    mese: pick("mese"),
    dataDa: pick("dataDa"),
    dataA: pick("dataA"),
    lotto: pick("lotto"),
    citta: pick("citta"),
    cliente: pick("cliente"),
    affidoDa: pick("affidoDa"),
    affidoA: pick("affidoA"),
    metodo: pick("metodo"),
    ricevuta: pick("ricevuta"),
    causale: pick("causale"),
    capDa: pick("capDa"),
    capA: pick("capA"),
    scaricoDa: pick("scaricoDa"),
    scaricoA: pick("scaricoA"),
  };
}

export function hasIncassiElencoFiltri(f: IncassiElencoFiltri) {
  return Object.values(f).some(Boolean);
}
