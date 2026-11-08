/** Campi ordinamento elenco pratiche (client + server). */

export type SortField =
  | "numero"
  | "debitore"
  | "cap"
  | "citta"
  | "prov"
  | "telefono"
  | "dataAffido"
  | "scadenza"
  | "scadenzaStragiud"
  | "mandante"
  | "lotto"
  | "assegnatario"
  | "codScarico"
  | "affidoProvv"
  | "stato"
  | "esito"
  | "ultimaLavorazione"
  | "ultimaLavorazioneOra"
  | "residuo"
  | "importoRata"
  | "rateScadute"
  | "totIncassato"
  | "importoTot"
  | "cfPiva"
  | "garante";

export type SortDir = "asc" | "desc";

export const SORT_COLUMNS: { key: SortField; label: string }[] = [
  { key: "numero", label: "Pratica n." },
  { key: "debitore", label: "Debitore" },
  { key: "cap", label: "CAP" },
  { key: "citta", label: "Città" },
  { key: "prov", label: "Prov." },
  { key: "telefono", label: "Telefono" },
  { key: "dataAffido", label: "Data affido" },
  { key: "scadenza", label: "Scad. mandato" },
  { key: "scadenzaStragiud", label: "Scad. stragiud." },
  { key: "mandante", label: "Mandante" },
  { key: "lotto", label: "Perimetro" },
  { key: "assegnatario", label: "Assegnatario" },
  { key: "codScarico", label: "Cod. scarico" },
  { key: "affidoProvv", label: "Aff. provv." },
  { key: "stato", label: "Stato" },
  { key: "esito", label: "Esito contatto" },
  { key: "ultimaLavorazione", label: "Ultima lavorazione" },
  { key: "ultimaLavorazioneOra", label: "Ora lav." },
  { key: "residuo", label: "Residuo" },
  { key: "importoRata", label: "Imp. rata" },
  { key: "rateScadute", label: "Rate scad." },
  { key: "totIncassato", label: "Tot. inc." },
  { key: "importoTot", label: "Netto da pagare" },
  { key: "cfPiva", label: "C.F. / P.IVA" },
  { key: "garante", label: "Garante" },
];

export function parseSort(raw?: string | null): SortField {
  if (raw === "ultimoPagamento") return "ultimaLavorazione";
  if (raw && SORT_COLUMNS.some((c) => c.key === raw)) return raw as SortField;
  return "ultimaLavorazione";
}

export function parseDir(raw?: string | null, sort: SortField = "ultimaLavorazione"): SortDir {
  if (raw === "asc" || raw === "desc") return raw;
  return sort === "ultimaLavorazione" || sort === "ultimaLavorazioneOra" ? "asc" : "desc";
}

export function isUltimaLavorazioneSort(sort: SortField) {
  return sort === "ultimaLavorazione" || sort === "ultimaLavorazioneOra";
}
