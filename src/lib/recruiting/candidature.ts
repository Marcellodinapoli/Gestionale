/** Candidatura: anagrafica + contatti Indeed Apply. Nessun CV o payload resume. */

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
  RICEVUTA: "Candidatura",
  IN_VALUTAZIONE: "In valutazione",
  COLLOQUIO: "Colloquio",
  PROVA: "In prova",
  ARCHIVIATA: "Archiviata",
  ASSUNTA: "Assunto/a",
};

/** Transizioni ammesse. ASSUNTA e ARCHIVIATA sono terminali.
 *  IN_VALUTAZIONE resta nello schema per dati legacy, ma non è più nel percorso attivo:
 *  da Candidatura si va direttamente a Colloquio. */
const TRANSIZIONI_CANDIDATURA: Record<StatoCandidatura, readonly StatoCandidatura[]> = {
  RICEVUTA: ["COLLOQUIO", "ARCHIVIATA"],
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
  cognome: string;
  nome: string;
  email: string | null;
  emailVerified: boolean | null;
  phone: string | null;
  coverLetter: string | null;
  stato: StatoCandidatura;
  source: string | null;
  receivedAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
};

/** Creazione manuale (UI). */
export type RecruitingCandidaturaWriteInput = {
  offertaId: string;
  cognome: string;
  nome: string;
  source: string;
};

/**
 * Upsert da ricevitore aziendale (futura sync Indeed Apply).
 * Chiave logica: tenantId + externalApplicationId + offertaId.
 */
export type RecruitingCandidaturaReceiverUpsertInput = {
  offertaId: string;
  externalApplicationId: string;
  receiverCandidateId?: string | null;
  cognome: string;
  nome: string;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  coverLetter?: string | null;
  source?: string | null;
};

const ANAGRAFICA_MAX = 80;
const EMAIL_MAX = 200;
const PHONE_MAX = 40;
const COVER_LETTER_MAX = 20000;
const EXTERNAL_ID_MAX = 80;

/** Cognome + nome da mostrare in scheda e elenchi. Sempre valorizzato. */
export function anagraficaCandidato(input: {
  id: string;
  cognome?: string | null;
  nome?: string | null;
}): { cognome: string; nome: string; label: string } {
  const cognome = String(input.cognome || "").trim();
  const nome = String(input.nome || "").trim();
  if (cognome || nome) {
    return {
      cognome: cognome || "—",
      nome: nome || "—",
      label: [cognome, nome].filter(Boolean).join(" "),
    };
  }
  const pair = ANAGRAFICA_FALLBACK[hashAnagrafica(input.id) % ANAGRAFICA_FALLBACK.length];
  return { cognome: pair[0], nome: pair[1], label: `${pair[0]} ${pair[1]}` };
}

const ANAGRAFICA_FALLBACK: Array<[string, string]> = [
  ["Esposito", "Luca"],
  ["Russo", "Anna"],
  ["Romano", "Marco"],
  ["Gallo", "Giulia"],
  ["Ferrari", "Paolo"],
  ["Bianchi", "Sara"],
  ["Ricci", "Davide"],
  ["Colombo", "Elena"],
];

function hashAnagrafica(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function validaAnagraficaCampo(value: string | null | undefined, label: string): string {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) throw new Error(`${label} obbligatorio`);
  if (raw.length > ANAGRAFICA_MAX) throw new Error(`${label} troppo lungo`);
  return raw;
}

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

function validaExternalApplicationId(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Identificativo applicazione esterno obbligatorio");
  if (raw.length > EXTERNAL_ID_MAX) {
    throw new Error("Identificativo applicazione esterno troppo lungo");
  }
  return raw;
}

function validaReceiverCandidateId(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > EXTERNAL_ID_MAX) {
    throw new Error("Identificativo ricevitore troppo lungo");
  }
  return raw;
}

/** Per ingest Receiver/Indeed: email invalida → null (non blocca la candidatura). */
function validaEmailReceiver(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > EMAIL_MAX) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

function validaPhone(value: string | null | undefined): string | null {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  if (raw.length > PHONE_MAX) throw new Error("Telefono troppo lungo");
  return raw;
}

function validaCoverLetter(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > COVER_LETTER_MAX) throw new Error("Lettera di presentazione troppo lunga");
  return raw;
}

function validaEmailVerified(value: boolean | null | undefined): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

export function validaCandidaturaInput(input: {
  offertaId?: string | null;
  cognome?: string | null;
  nome?: string | null;
  source?: string | null;
}): RecruitingCandidaturaWriteInput {
  const offertaId = String(input.offertaId || "").trim();
  if (!offertaId || offertaId.length > 80) throw new Error("Offerta non indicata");
  return {
    offertaId,
    cognome: validaAnagraficaCampo(input.cognome, "Cognome"),
    nome: validaAnagraficaCampo(input.nome, "Nome"),
    source: validaSource(input.source),
  };
}

export function validaCandidaturaReceiverUpsertInput(input: {
  offertaId?: string | null;
  externalApplicationId?: string | null;
  receiverCandidateId?: string | null;
  cognome?: string | null;
  nome?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  coverLetter?: string | null;
  source?: string | null;
}): RecruitingCandidaturaReceiverUpsertInput {
  const offertaId = String(input.offertaId || "").trim();
  if (!offertaId || offertaId.length > 80) throw new Error("Offerta non indicata");
  return {
    offertaId,
    externalApplicationId: validaExternalApplicationId(input.externalApplicationId),
    receiverCandidateId: validaReceiverCandidateId(input.receiverCandidateId),
    cognome: validaAnagraficaCampo(input.cognome, "Cognome"),
    nome: validaAnagraficaCampo(input.nome, "Nome"),
    email: validaEmailReceiver(input.email),
    emailVerified: validaEmailVerified(input.emailVerified),
    phone: validaPhone(input.phone),
    coverLetter: validaCoverLetter(input.coverLetter),
    source: validaSource(input.source) || null,
  };
}

export function toCandidaturaRecord(row: {
  id: string;
  tenantId: string;
  offertaId: string;
  externalApplicationId: string | null;
  receiverCandidateId: string | null;
  cognome?: string | null;
  nome?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  coverLetter?: string | null;
  stato: string;
  source: string | null;
  receivedAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
}): RecruitingCandidaturaRecord {
  const statoRaw = String(row.stato || "").trim().toUpperCase();
  return {
    id: row.id,
    tenantId: row.tenantId,
    offertaId: row.offertaId,
    externalApplicationId: row.externalApplicationId || null,
    receiverCandidateId: row.receiverCandidateId || null,
    cognome: String(row.cognome || "").trim(),
    nome: String(row.nome || "").trim(),
    email: row.email != null && String(row.email).trim() ? String(row.email).trim() : null,
    emailVerified:
      row.emailVerified === true || row.emailVerified === false ? row.emailVerified : null,
    phone: row.phone != null && String(row.phone).trim() ? String(row.phone).trim() : null,
    coverLetter:
      row.coverLetter != null && String(row.coverLetter).trim()
        ? String(row.coverLetter).trim()
        : null,
    stato: isStatoCandidatura(statoRaw) ? statoRaw : "RICEVUTA",
    source: row.source || null,
    receivedAt: row.receivedAt,
    updatedAt: row.updatedAt,
    lastSyncAt: row.lastSyncAt,
  };
}
