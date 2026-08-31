export const CONDIZIONI_ECONOMICHE = [
  { value: "SOLO_PROVV", label: "Solo provvigioni" },
  { value: "FISSO_PROVV", label: "Fisso + provvigioni" },
] as const;

export type CondizioneEconomica = (typeof CONDIZIONI_ECONOMICHE)[number]["value"];

export function parseCondizioneEconomica(raw: unknown): CondizioneEconomica {
  const v = String(raw || "").trim().toUpperCase();
  return v === "FISSO_PROVV" ? "FISSO_PROVV" : "SOLO_PROVV";
}

export function condizioneEconomicaLabel(value: unknown): string {
  const v = parseCondizioneEconomica(value);
  return CONDIZIONI_ECONOMICHE.find((c) => c.value === v)?.label ?? "Solo provvigioni";
}

export function parseImportoFisso(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function assertCondizioneEconomica(
  condizione: CondizioneEconomica,
  importoFisso: number | null
): void {
  if (condizione === "FISSO_PROVV" && importoFisso == null) {
    throw new Error("Inserisci l'importo fisso mensile");
  }
}
