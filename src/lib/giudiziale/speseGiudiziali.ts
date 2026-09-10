/** Spese giudiziali — dettaglio solo in Legal; totale sintetico sulla pratica. */

export const TIPOLOGIE_SPESA_GIUDIZIALE = [
  { value: "ANTICIPAZIONE", label: "Anticipazione" },
  { value: "COMPETENZE", label: "Competenze" },
  { value: "CONTRIBUTO", label: "Contributo" },
  { value: "NOTIFICA", label: "Notifica" },
  { value: "BOLLO", label: "Bollo / marca" },
  { value: "ONORARI", label: "Onorari" },
  { value: "SPESE_PROCESSUALI", label: "Spese processuali" },
  { value: "ALTRO", label: "Altra voce economica" },
] as const;

export type TipologiaSpesaGiudiziale =
  (typeof TIPOLOGIE_SPESA_GIUDIZIALE)[number]["value"];

export type SpesaGiudizialeVoce = {
  id: string;
  /** ISO date YYYY-MM-DD */
  data: string;
  tipologia: TipologiaSpesaGiudiziale | string;
  descrizione: string;
  importo: number;
  note: string;
  /** Soft-delete: esclusa dal totale ma resta nello storico Legal. */
  annullata: boolean;
};

export function labelTipologiaSpesa(value?: string | null) {
  return (
    TIPOLOGIE_SPESA_GIUDIZIALE.find((t) => t.value === value)?.label ||
    value ||
    "—"
  );
}

export function emptySpesaGiudizialeVoce(): SpesaGiudizialeVoce {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `spesa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    data: "",
    tipologia: "ALTRO",
    descrizione: "",
    importo: 0,
    note: "",
    annullata: false,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function parseSpeseGiudizialiJson(
  raw?: string | null
): SpesaGiudizialeVoce[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): SpesaGiudizialeVoce | null => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const id = String(o.id || "").trim();
        if (!id) return null;
        const importo = Number(o.importo);
        return {
          id,
          data: String(o.data || "").trim().slice(0, 10),
          tipologia: String(o.tipologia || "ALTRO").trim() || "ALTRO",
          descrizione: String(o.descrizione || "").trim(),
          importo: Number.isFinite(importo) ? round2(importo) : 0,
          note: String(o.note || "").trim(),
          annullata: Boolean(o.annullata),
        };
      })
      .filter((x): x is SpesaGiudizialeVoce => x != null);
  } catch {
    return [];
  }
}

export function serializeSpeseGiudizialiJson(voci: SpesaGiudizialeVoce[]) {
  return JSON.stringify(
    voci.map((v) => ({
      id: v.id,
      data: v.data || "",
      tipologia: v.tipologia || "ALTRO",
      descrizione: (v.descrizione || "").trim(),
      importo: round2(Number(v.importo) || 0),
      note: (v.note || "").trim(),
      annullata: Boolean(v.annullata),
    }))
  );
}

/** Totale attivo (esclude voci annullate). */
export function totaleSpeseGiudiziali(voci: SpesaGiudizialeVoce[]) {
  return round2(
    voci
      .filter((v) => !v.annullata)
      .reduce((sum, v) => sum + (Number(v.importo) || 0), 0)
  );
}

export function normalizeSpeseGiudizialiInput(
  raw: unknown
): { voci: SpesaGiudizialeVoce[]; totale: number; json: string } {
  let voci: SpesaGiudizialeVoce[] = [];
  if (typeof raw === "string") {
    voci = parseSpeseGiudizialiJson(raw);
  } else if (Array.isArray(raw)) {
    voci = parseSpeseGiudizialiJson(JSON.stringify(raw));
  }
  const totale = totaleSpeseGiudiziali(voci);
  return {
    voci,
    totale,
    json: serializeSpeseGiudizialiJson(voci),
  };
}

/** Riepilogo testuale legacy (campo CostiSostenuti). */
export function costiSostenutiDaTotale(totale: number) {
  return `€ ${totale.toFixed(2)}`;
}
