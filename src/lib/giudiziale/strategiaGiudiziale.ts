/** Costanti — Strategia / procedura giudiziale. */

export const STRATEGIE_SCELTE = [
  { value: "DECRETO_INGIUNTIVO", label: "Decreto ingiuntivo" },
  { value: "PRECETTO", label: "Precetto" },
  { value: "PIGNORAMENTO", label: "Pignoramento" },
  { value: "CAUSA_ORDINARIA", label: "Causa ordinaria" },
  { value: "CONCORSUALE", label: "Procedura concorsuale" },
  { value: "ALTRO", label: "Altro" },
] as const;

export const ATTIVITA_PROCEDURA = [
  { key: "preparazioneDocumenti", label: "Preparazione documenti" },
  { key: "conferimentoIncarico", label: "Conferimento incarico" },
  { key: "redazioneAtto", label: "Redazione atto" },
  { key: "deposito", label: "Deposito" },
  { key: "notifica", label: "Notifica" },
  { key: "udienza", label: "Udienza" },
  { key: "opposizione", label: "Eventuale opposizione" },
  { key: "esecuzione", label: "Esecuzione" },
] as const;

export type AttivitaProceduraKey = (typeof ATTIVITA_PROCEDURA)[number]["key"];

export const STATI_ATTIVITA_PROCEDURA = [
  { value: "DA_FARE", label: "Da fare" },
  { value: "IN_CORSO", label: "In corso" },
  { value: "FATTO", label: "Fatto" },
  { value: "NON_APPLICABILE", label: "N/A" },
] as const;

export type StatoAttivitaProcedura =
  (typeof STATI_ATTIVITA_PROCEDURA)[number]["value"];

export type AttivitaProceduraItem = {
  stato: StatoAttivitaProcedura | "";
  responsabile: string;
  scadenza: string;
};

export type AttivitaProceduraMap = Record<
  AttivitaProceduraKey,
  AttivitaProceduraItem
>;

export function emptyAttivitaProcedura(): AttivitaProceduraMap {
  const out = {} as AttivitaProceduraMap;
  for (const a of ATTIVITA_PROCEDURA) {
    out[a.key] = { stato: "", responsabile: "", scadenza: "" };
  }
  return out;
}

export function parseAttivitaProceduraJson(
  raw?: string | null
): AttivitaProceduraMap {
  const base = emptyAttivitaProcedura();
  if (!raw?.trim()) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<string, Partial<AttivitaProceduraItem>>
    >;
    for (const a of ATTIVITA_PROCEDURA) {
      const row = parsed[a.key];
      if (!row) continue;
      base[a.key] = {
        stato: (row.stato as AttivitaProceduraItem["stato"]) || "",
        responsabile: row.responsabile || "",
        scadenza: row.scadenza || "",
      };
    }
  } catch {
    /* ignore */
  }
  return base;
}

export const STATI_PROCEDURA = [
  { value: "DA_AVVIARE", label: "Da avviare" },
  { value: "IN_CORSO", label: "In corso" },
  { value: "SOSPESA", label: "Sospesa" },
  { value: "IN_ESECUZIONE", label: "In esecuzione" },
  { value: "CONCLUSA", label: "Conclusa" },
] as const;

export const ESITI_GIUDIZIALI = [
  { value: "POSITIVO", label: "Esito positivo" },
  { value: "PARZIALE", label: "Esito parziale" },
  { value: "NEGATIVO", label: "Esito negativo" },
  { value: "CHIUSA", label: "Procedura chiusa/archiviata" },
  { value: "ALTRO", label: "Altra definizione" },
] as const;

export type EsitoGiudiziale = (typeof ESITI_GIUDIZIALI)[number]["value"];

/** Valori legacy ancora presenti in DB — solo display. */
const ESITO_LEGACY_LABELS: Record<string, string> = {
  RECUPERATO: "Esito positivo",
  PARZIALMENTE_RECUPERATO: "Esito parziale",
  INESIGIBILE: "Esito negativo",
  PROCEDURA_CONCLUSA: "Procedura chiusa/archiviata",
};

export function labelEsitoGiudiziale(value?: string | null) {
  if (!value) return "—";
  return (
    ESITI_GIUDIZIALI.find((e) => e.value === value)?.label ||
    ESITO_LEGACY_LABELS[value] ||
    value
  );
}

export function labelStatoProcedura(value?: string | null) {
  return STATI_PROCEDURA.find((s) => s.value === value)?.label ?? value ?? "—";
}

export function labelStrategiaScelta(value?: string | null) {
  return STRATEGIE_SCELTE.find((s) => s.value === value)?.label ?? value ?? "—";
}
