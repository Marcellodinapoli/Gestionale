/** Operatori filtro codice scarico (Altri filtri). */

import { isCodiceScarico } from "@/lib/scarico";

export type CodScaricoOp = "eq" | "ne";

export const COD_SCARICO_FILTER_OPS: {
  value: CodScaricoOp;
  label: string;
  title: string;
}[] = [
  { value: "eq", label: "=", title: "Uguale" },
  { value: "ne", label: "≠", title: "Diverso" },
];

export const COD_SCARICO_LIST_SEP = ",";

export function parseCodScaricoOp(raw?: string | null): CodScaricoOp {
  if (raw === "ne") return "ne";
  return "eq";
}

export function labelCodScaricoOp(op?: CodScaricoOp | null) {
  return COD_SCARICO_FILTER_OPS.find((o) => o.value === parseCodScaricoOp(op))?.label ?? "=";
}

/** Elenco codici da parametro URL (singolo o multiplo, separatore virgola). */
export function parseCodScaricoList(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(COD_SCARICO_LIST_SEP)) {
    const code = part.trim();
    if (!code || seen.has(code) || !isCodiceScarico(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function joinCodScaricoList(codes: readonly string[]): string {
  return [...new Set(codes.filter((c) => isCodiceScarico(c)))].join(COD_SCARICO_LIST_SEP);
}

export function hasCodScaricoFiltro(raw?: string | null) {
  return parseCodScaricoList(raw).length > 0;
}
