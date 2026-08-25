export const CATEGORY_SOLLECITO = "Sollecito";
export const CATEGORY_RECUPERO = "Recupero";

export function isRecuperoCategory(category: string) {
  return category === CATEGORY_RECUPERO;
}

/** index 0-based → Corso 1 / Corso 1A */
export function courseLabel(category: string, index: number) {
  const n = index + 1;
  return isRecuperoCategory(category) ? `Corso ${n}A` : `Corso ${n}`;
}

export function storageCategory(catalogCategory: string) {
  return isRecuperoCategory(catalogCategory) ? "post" : "pre";
}
