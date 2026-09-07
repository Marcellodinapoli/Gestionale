/** Operatori filtro codice scarico (Altri filtri). */

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

/** Token filtro: pratiche senza codice scarico (NULL / vuoto). */
export const COD_SCARICO_NULL = "NULL";

export const COD_SCARICO_NULL_LABEL = "null — Senza codice";

/** Accetta codici catalogo, custom di perimetro e il token NULL. */
export function isCodiceScaricoFiltroToken(value?: string | null): boolean {
  const code = String(value || "").trim().toUpperCase();
  if (code === COD_SCARICO_NULL) return true;
  return /^[A-Z0-9]{2,8}$/.test(code);
}

export function isCodScaricoNullToken(value?: string | null): boolean {
  return String(value || "").trim().toUpperCase() === COD_SCARICO_NULL;
}

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
    const code = part.trim().toUpperCase();
    if (!code || seen.has(code) || !isCodiceScaricoFiltroToken(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function joinCodScaricoList(codes: readonly string[]): string {
  return [
    ...new Set(
      codes
        .map((c) => c.trim().toUpperCase())
        .filter((c) => isCodiceScaricoFiltroToken(c))
    ),
  ].join(COD_SCARICO_LIST_SEP);
}

export function hasCodScaricoFiltro(raw?: string | null) {
  return parseCodScaricoList(raw).length > 0;
}

/** Separa token NULL dai codici reali. */
export function splitCodScaricoFiltro(codes: readonly string[]): {
  wantsNull: boolean;
  real: string[];
} {
  const real: string[] = [];
  let wantsNull = false;
  for (const c of codes) {
    if (isCodScaricoNullToken(c)) wantsNull = true;
    else real.push(c.trim().toUpperCase());
  }
  return { wantsNull, real };
}

export function labelCodScaricoFiltroCode(code: string): string {
  if (isCodScaricoNullToken(code)) return "null";
  return code;
}

/**
 * Where Prisma per filtro codice scarico (operatore o bk), incluso token NULL.
 */
export function codiceScaricoFiltroWhere(
  field: "codiceScarico" | "codiceScaricoBk",
  codes: readonly string[],
  op: CodScaricoOp
): Record<string, unknown> | null {
  if (!codes.length) return null;
  const { wantsNull, real } = splitCodScaricoFiltro(codes);

  if (op === "ne") {
    if (wantsNull && !real.length) {
      return { [field]: { not: null } };
    }
    if (wantsNull && real.length) {
      return {
        AND: [{ [field]: { not: null } }, { [field]: { notIn: real } }],
      };
    }
    return { [field]: { notIn: real } };
  }

  // eq
  if (wantsNull && !real.length) {
    return { [field]: null };
  }
  if (wantsNull && real.length === 1) {
    return { OR: [{ [field]: null }, { [field]: real[0]! }] };
  }
  if (wantsNull && real.length > 1) {
    return { OR: [{ [field]: null }, { [field]: { in: real } }] };
  }
  if (real.length === 1) return { [field]: real[0]! };
  return { [field]: { in: real } };
}
