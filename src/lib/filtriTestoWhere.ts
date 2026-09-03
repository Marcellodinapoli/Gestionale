import type { Prisma } from "@prisma/client";
import { parseTextFilterOp, type TextFilterOp } from "@/lib/filtriTestoOp";

/** Confronto stringhe ignorando maiuscole/minuscole. */
export function stringsEqualInsensitive(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

/**
 * Clausola Prisma per filtri testo (= / ≠) case-insensitive su tutti i backend.
 * - SQLite: LIKE
 * - Firestore shim: matchScalar su contains
 */
export function prismaTextClause(
  value: string,
  op?: TextFilterOp | null
): Prisma.StringFilter {
  const parsed = parseTextFilterOp(op);
  const trimmed = value.trim();
  if (!trimmed) return { equals: trimmed };

  if (parsed === "ne") return { not: { contains: trimmed } };
  return { contains: trimmed };
}

/** @deprecated usa prismaTextClause */
export function prismaContainsClause(value: string, op?: TextFilterOp | null) {
  return prismaTextClause(value, op);
}
