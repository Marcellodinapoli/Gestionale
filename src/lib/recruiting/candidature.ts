/** Metadati tecnici candidatura. Nessun dato personale, CV o payload esterno. */

export const STATI_CANDIDATURA = [
  "RICEVUTA",
  "IN_VALUTAZIONE",
  "COLLOQUIO",
  "PROVA",
  "ARCHIVIATA",
  "ASSUNTA",
] as const;

export type StatoCandidatura = (typeof STATI_CANDIDATURA)[number];

export const STATO_CANDIDATURA_LABELS: Record<StatoCandidatura, string> = {
  RICEVUTA: "Ricevuta",
  IN_VALUTAZIONE: "In valutazione",
  COLLOQUIO: "Colloquio",
  PROVA: "Prova",
  ARCHIVIATA: "Archiviata",
  ASSUNTA: "Assunto/a",
};

/** Transizioni ammesse. ASSUNTA e ARCHIVIATA sono terminali. */
const TRANSIZIONI_CANDIDATURA: Record<StatoCandidatura, readonly StatoCandidatura[]> = {
  RICEVUTA: ["IN_VALUTAZIONE", "ARCHIVIATA"],
  IN_VALUTAZIONE: ["COLLOQUIO", "ARCHIVIATA"],
  COLLOQUIO: ["PROVA", "ARCHIVIATA"],
  PROVA: ["ASSUNTA", "ARCHIVIATA"],
  ARCHIVIATA: [],
  ASSUNTA: [],
};

export function transizioniConsentiteCandidatura(
  from: StatoCandidatura
): StatoCandidatura[] {
  return [...(TRANSIZIONI_CANDIDATURA[from] ?? [])];
}

export function isTransizioneCandidaturaConsentita(
  from: StatoCandidatura,
  to: StatoCandidatura
): boolean {
  return transizioniConsentiteCandidatura(from).includes(to);
}

export function assertTransizioneCandidatura(
  from: StatoCandidatura,
  to: StatoCandidatura
): void {
  if (!isTransizioneCandidaturaConsentita(from, to)) {
    throw new Error("Transizione di stato non consentita");
  }
}

export function isStatoCandidaturaTerminale(stato: StatoCandidatura): boolean {
  return stato === "ASSUNTA" || stato === "ARCHIVIATA";
}

export function assertCandidaturaOperabile(stato: StatoCandidatura): void {
  if (isStatoCandidaturaTerminale(stato)) {
    throw new Error("Candidatura non modificabile");
  }
}

export type RecruitingCandidaturaRecord = {
  id: string;
  tenantId: string;
  offertaId: string;
  externalApplicationId: string | null;
  receiverCandidateId: string | null;
  stato: StatoCandidatura;
  source: string | null;
  receivedAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
};

export type RecruitingCandidaturaWriteInput = {
  offertaId: string;
  source: string;
};

const SOURCE_MAX = 80;

export function isStatoCandidatura(value: string): value is StatoCandidatura {
  return (STATI_CANDIDATURA as readonly string[]).includes(value);
}

export function parseStatoCandidatura(value: string | null | undefined): StatoCandidatura {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || !isStatoCandidatura(raw)) {
    throw new Error("Stato candidatura non valido");
  }
  return raw;
}

function validaSource(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > SOURCE_MAX) throw new Error("Origine troppo lunga");
  if (!/^[A-Za-z0-9._:-]+$/.test(raw)) {
    throw new Error("Origine: usare solo un'etichetta tecnica");
  }
  return raw;
}

export function validaCandidaturaInput(input: {
  offertaId?: string | null;
  source?: string | null;
}): RecruitingCandidaturaWriteInput {
  const offertaId = String(input.offertaId || "").trim();
  if (!offertaId || offertaId.length > 80) throw new Error("Offerta non indicata");
  return {
    offertaId,
    source: validaSource(input.source),
  };
}

export function toCandidaturaRecord(row: {
  id: string;
  tenantId: string;
  offertaId: string;
  externalApplicationId: string | null;
  receiverCandidateId: string | null;
  stato: string;
  source: string | null;
  receivedAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
}): RecruitingCandidaturaRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    offertaId: row.offertaId,
    externalApplicationId: row.externalApplicationId || null,
    receiverCandidateId: row.receiverCandidateId || null,
    stato: isStatoCandidatura(row.stato) ? row.stato : "RICEVUTA",
    source: row.source || null,
    receivedAt: row.receivedAt,
    updatedAt: row.updatedAt,
    lastSyncAt: row.lastSyncAt,
  };
}
