/** Normalizza `_count` da groupBy/aggregate (numero oppure `{ _all: n }`). */
export function prismaCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "_all" in value) {
    const n = Number((value as { _all: unknown })._all);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
