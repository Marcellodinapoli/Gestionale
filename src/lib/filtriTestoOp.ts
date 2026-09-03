/** Operatori filtro testo (campi anagrafica / note). */

export type TextFilterOp = "eq" | "ne";

export const TEXT_FILTER_OPS: {
  value: TextFilterOp;
  label: string;
  title: string;
}[] = [
  { value: "eq", label: "=", title: "Uguale" },
  { value: "ne", label: "≠", title: "Diverso" },
];

export const TEXT_FILTER_DEFAULT: TextFilterOp = "eq";

export function parseTextFilterOp(raw?: string | null): TextFilterOp {
  if (raw === "ne") return "ne";
  // Legacy URL con "contains" (⊃): trattato come uguale.
  return TEXT_FILTER_DEFAULT;
}

export function labelTextFilterOp(op?: TextFilterOp | null) {
  return TEXT_FILTER_OPS.find((o) => o.value === parseTextFilterOp(op))?.label ?? "=";
}

/** Campi testo con operatore (esclusi da/a e select). */
export const TEXT_FILTER_FIELD_SPECS = [
  { field: "debitore", op: "debitoreOp" },
  { field: "citta", op: "cittaOp" },
  { field: "prov", op: "provOp" },
  { field: "telefono", op: "telefonoOp" },
  { field: "cfPiva", op: "cfPivaOp" },
  { field: "garante", op: "garanteOp" },
  { field: "note", op: "noteOp" },
] as const;

export type TextFilterField = (typeof TEXT_FILTER_FIELD_SPECS)[number]["field"];
export type TextFilterOpKey = (typeof TEXT_FILTER_FIELD_SPECS)[number]["op"];

/** Select con operatore = / ≠ (sit. affido, mandato, perimetro, lotto). Cod. operatore gestito a parte. */
export const SELECT_FILTER_FIELD_SPECS = [
  { field: "sitAffido", op: "sitAffidoOp" },
  { field: "mandato", op: "mandatoOp" },
  { field: "perimetro", op: "perimetroOp" },
  { field: "lotto", op: "lottoOp" },
] as const;

export type SelectFilterField = (typeof SELECT_FILTER_FIELD_SPECS)[number]["field"];
export type SelectFilterOpKey = (typeof SELECT_FILTER_FIELD_SPECS)[number]["op"];
