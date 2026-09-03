/** Catalogo campi filtro aggiuntivo (estratto conto, fatture, incassi) — safe per Client. */

export type AggiuntivoGruppo = "estratto_anagrafica" | "estratto_pratica" | "fatture" | "incassi";

export type AggiuntivoCampoKey = (typeof AGGIUNTIVO_CAMPI)[number]["key"];

export const AGGIUNTIVO_GRUPPI: { id: AggiuntivoGruppo; label: string }[] = [
  { id: "estratto_anagrafica", label: "Estratto conto — anagrafica" },
  { id: "estratto_pratica", label: "Estratto conto — pratica" },
  { id: "fatture", label: "Fatture insolute" },
  { id: "incassi", label: "Incassi registrati" },
];

export const AGGIUNTIVO_CAMPI = [
  { key: "ndg", label: "NDG", gruppo: "estratto_anagrafica" as const },
  { key: "tipo", label: "Tipo", gruppo: "estratto_anagrafica" as const },
  { key: "nominativo", label: "Nominativo", gruppo: "estratto_anagrafica" as const },
  { key: "indirizzo", label: "Indirizzo", gruppo: "estratto_anagrafica" as const },
  { key: "localita", label: "Località", gruppo: "estratto_anagrafica" as const },
  { key: "cap", label: "CAP", gruppo: "estratto_anagrafica" as const },
  { key: "provincia", label: "Provincia", gruppo: "estratto_anagrafica" as const },
  { key: "cedente", label: "Cedente", gruppo: "estratto_pratica" as const },
  { key: "contratto", label: "Contratto", gruppo: "estratto_pratica" as const },
  { key: "societa", label: "Società", gruppo: "estratto_pratica" as const },
  { key: "importo_definito", label: "Importo definito", gruppo: "estratto_pratica" as const },
  { key: "fattura_numero", label: "Num. fattura", gruppo: "fatture" as const },
  { key: "fattura_causale", label: "Per./Causale", gruppo: "fatture" as const },
  { key: "fattura_data", label: "Data fattura", gruppo: "fatture" as const },
  { key: "fattura_scadenza", label: "Data scadenza", gruppo: "fatture" as const },
  { key: "fattura_importo", label: "Importo", gruppo: "fatture" as const },
  { key: "fattura_pagato", label: "Pagato", gruppo: "fatture" as const },
  { key: "incasso_data", label: "Data", gruppo: "incassi" as const },
  { key: "incasso_metodo", label: "Metodo", gruppo: "incassi" as const },
  { key: "incasso_modo", label: "Mo", gruppo: "incassi" as const },
  { key: "incasso_importo", label: "Importo", gruppo: "incassi" as const },
  { key: "incasso_capitale", label: "Capitale", gruppo: "incassi" as const },
  { key: "incasso_interessi", label: "Interessi", gruppo: "incassi" as const },
  { key: "incasso_spese", label: "Spese", gruppo: "incassi" as const },
  { key: "incasso_causale", label: "Causale", gruppo: "incassi" as const },
  { key: "incasso_operatore", label: "Operatore", gruppo: "incassi" as const },
] as const;

const campoByKey = new Map(AGGIUNTIVO_CAMPI.map((c) => [c.key, c]));

export function isAggiuntivoCampoKey(raw?: string | null): raw is AggiuntivoCampoKey {
  return Boolean(raw && campoByKey.has(raw as AggiuntivoCampoKey));
}

export function labelAggiuntivoCampo(key?: string | null): string {
  if (!key) return "—";
  return campoByKey.get(key as AggiuntivoCampoKey)?.label ?? key;
}

export function hasAggiuntivoFiltro(campo?: string | null, valore?: string | null) {
  return Boolean(campo?.trim() && valore?.trim());
}

const AGGIUNTIVO_CAMPI_NUMERICI = new Set<AggiuntivoCampoKey>([
  "importo_definito",
  "fattura_importo",
  "fattura_pagato",
  "incasso_importo",
  "incasso_capitale",
  "incasso_interessi",
  "incasso_spese",
]);

const AGGIUNTIVO_CAMPI_DATA = new Set<AggiuntivoCampoKey>([
  "fattura_data",
  "fattura_scadenza",
  "incasso_data",
]);

export function aggiuntivoValoreInputType(
  campo?: string | null
): "text" | "number" {
  if (campo && AGGIUNTIVO_CAMPI_NUMERICI.has(campo as AggiuntivoCampoKey)) {
    return "number";
  }
  return "text";
}

export function aggiuntivoValorePlaceholder(
  campo?: string | null,
  op?: string | null
): string {
  if (!campo?.trim()) return "Seleziona prima il campo";
  const ne = op === "ne";
  if (AGGIUNTIVO_CAMPI_DATA.has(campo as AggiuntivoCampoKey)) {
    return ne ? "Data da escludere (gg/mm/aaaa)" : "Data (gg/mm/aaaa)";
  }
  if (AGGIUNTIVO_CAMPI_NUMERICI.has(campo as AggiuntivoCampoKey)) {
    return ne ? "Importo diverso da…" : "Importo uguale a…";
  }
  return ne ? "Testo da escludere" : "Testo da cercare";
}
