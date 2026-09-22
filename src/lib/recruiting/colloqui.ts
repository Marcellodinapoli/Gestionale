/** Colloqui candidatura. Nessun PII/CV. Macchina a stati distinta da RecruitingCandidatura. */

import type { StatoCandidatura } from "@/lib/recruiting/candidature";
import { parseOccurredAt, validaNoteAttivita } from "@/lib/recruiting/attivita";

export const STATI_COLLOQUIO = ["PROGRAMMATO", "SVOLTO", "ESITATO", "ANNULLATO"] as const;
export type StatoColloquio = (typeof STATI_COLLOQUIO)[number];

export const STATO_COLLOQUIO_LABELS: Record<StatoColloquio, string> = {
  PROGRAMMATO: "Programmato",
  SVOLTO: "Svolto",
  ESITATO: "Esitato",
  ANNULLATO: "Annullato",
};

const TRANSIZIONI_COLLOQUIO: Record<StatoColloquio, readonly StatoColloquio[]> = {
  PROGRAMMATO: ["SVOLTO", "ANNULLATO"],
  SVOLTO: ["ESITATO"],
  ESITATO: [],
  ANNULLATO: [],
};

export const MODALITA_COLLOQUIO = ["PRESENZA", "VIDEO", "TELEFONO"] as const;
export type ModalitaColloquio = (typeof MODALITA_COLLOQUIO)[number];

export const MODALITA_COLLOQUIO_LABELS: Record<ModalitaColloquio, string> = {
  PRESENZA: "In presenza",
  VIDEO: "Video",
  TELEFONO: "Telefono",
};

export const ESITI_COLLOQUIO = ["POSITIVO", "NEGATIVO", "DA_RIVALUTARE", "ASSENTE"] as const;
export type EsitoColloquio = (typeof ESITI_COLLOQUIO)[number];

export const ESITO_COLLOQUIO_LABELS: Record<EsitoColloquio, string> = {
  POSITIVO: "Positivo",
  NEGATIVO: "Negativo",
  DA_RIVALUTARE: "Da rivalutare",
  ASSENTE: "Assente",
};

export type RecruitingColloquioRecord = {
  id: string;
  tenantId: string;
  candidaturaId: string;
  round: number;
  stato: StatoColloquio;
  scheduledAt: Date;
  modalita: ModalitaColloquio;
  intervistatoreUserId: string | null;
  intervistatoreLabel: string;
  intervistatoreNome: string;
  notePreliminari: string;
  noteSvolgimento: string;
  esito: EsitoColloquio | null;
  valutazione: string;
  valutazioneStelle: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

const LABEL_MAX = 120;

export function isStatoColloquio(value: string): value is StatoColloquio {
  return (STATI_COLLOQUIO as readonly string[]).includes(value);
}

export function isModalitaColloquio(value: string): value is ModalitaColloquio {
  return (MODALITA_COLLOQUIO as readonly string[]).includes(value);
}

export function isEsitoColloquio(value: string): value is EsitoColloquio {
  return (ESITI_COLLOQUIO as readonly string[]).includes(value);
}

export function isStatoColloquioTerminale(stato: StatoColloquio): boolean {
  return stato === "ESITATO" || stato === "ANNULLATO";
}

export function transizioniConsentiteColloquio(from: StatoColloquio): StatoColloquio[] {
  return [...(TRANSIZIONI_COLLOQUIO[from] ?? [])];
}

export function isTransizioneColloquioConsentita(from: StatoColloquio, to: StatoColloquio): boolean {
  return transizioniConsentiteColloquio(from).includes(to);
}

export function assertTransizioneColloquio(from: StatoColloquio, to: StatoColloquio): void {
  if (!isTransizioneColloquioConsentita(from, to)) {
    throw new Error("Transizione colloquio non consentita");
  }
}

export function canCreateColloquio(statoCandidatura: StatoCandidatura): boolean {
  return (
    statoCandidatura === "RICEVUTA" ||
    statoCandidatura === "IN_VALUTAZIONE" ||
    statoCandidatura === "COLLOQUIO"
  );
}

export function assertCanCreateColloquio(statoCandidatura: StatoCandidatura): void {
  if (!canCreateColloquio(statoCandidatura)) {
    throw new Error("Colloquio non programmabile in questo stato");
  }
}

export function validaColloquioCreateInput(input: {
  candidaturaId?: string | null;
  scheduledAt?: string | null;
  modalita?: string | null;
  intervistatoreUserId?: string | null;
  intervistatoreLabel?: string | null;
  notePreliminari?: string | null;
}): {
  candidaturaId: string;
  scheduledAt: Date;
  modalita: ModalitaColloquio;
  intervistatoreUserId: string;
  intervistatoreLabel: string;
  notePreliminari: string;
} {
  const candidaturaId = String(input.candidaturaId || "").trim();
  if (!candidaturaId || candidaturaId.length > 80) throw new Error("Candidatura non indicata");
  const scheduledRaw = String(input.scheduledAt || "").trim();
  if (!scheduledRaw) throw new Error("Data e ora del colloquio obbligatorie");
  const modalitaRaw = String(input.modalita || "").trim().toUpperCase();
  if (!isModalitaColloquio(modalitaRaw)) throw new Error("Modalità non valida");
  const intervistatoreUserId = String(input.intervistatoreUserId || "").trim();
  if (!intervistatoreUserId) throw new Error("Intervistatore obbligatorio");
  if (intervistatoreUserId.length > 80) throw new Error("Intervistatore non valido");
  const intervistatoreLabel = String(input.intervistatoreLabel || "").trim();
  if (!intervistatoreLabel) throw new Error("Intervistatore obbligatorio");
  if (intervistatoreLabel.length > LABEL_MAX) throw new Error("Referente troppo lungo");
  return {
    candidaturaId,
    scheduledAt: parseOccurredAt(scheduledRaw),
    modalita: modalitaRaw,
    intervistatoreUserId,
    intervistatoreLabel,
    notePreliminari: validaNoteAttivita(input.notePreliminari),
  };
}

export function validaColloquioUpdateInput(input: {
  id?: string | null;
  scheduledAt?: string | null;
  modalita?: string | null;
  intervistatoreUserId?: string | null;
  intervistatoreLabel?: string | null;
  notePreliminari?: string | null;
}): {
  id: string;
  scheduledAt: Date;
  modalita: ModalitaColloquio;
  intervistatoreUserId: string;
  intervistatoreLabel: string;
  notePreliminari: string;
} {
  const id = String(input.id || "").trim();
  if (!id || id.length > 80) throw new Error("Colloquio non indicato");
  const base = validaColloquioCreateInput({
    candidaturaId: "placeholder",
    scheduledAt: input.scheduledAt,
    modalita: input.modalita,
    intervistatoreUserId: input.intervistatoreUserId,
    intervistatoreLabel: input.intervistatoreLabel,
    notePreliminari: input.notePreliminari,
  });
  return {
    id,
    scheduledAt: base.scheduledAt,
    modalita: base.modalita,
    intervistatoreUserId: base.intervistatoreUserId,
    intervistatoreLabel: base.intervistatoreLabel,
    notePreliminari: base.notePreliminari,
  };
}

export function validaSvolgimentoInput(input: {
  id?: string | null;
  noteSvolgimento?: string | null;
  valutazioneStelle?: string | number | null;
}): { id: string; noteSvolgimento: string; valutazioneStelle: number | null } {
  const id = String(input.id || "").trim();
  if (!id || id.length > 80) throw new Error("Colloquio non indicato");
  const raw = input.valutazioneStelle;
  let valutazioneStelle: number | null = null;
  if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      throw new Error("Valutazione stelle non valida (1–5)");
    }
    valutazioneStelle = n;
  }
  return {
    id,
    noteSvolgimento: validaNoteAttivita(input.noteSvolgimento),
    valutazioneStelle,
  };
}

export function validaEsitoColloquioInput(input: {
  id?: string | null;
  esito?: string | null;
  valutazione?: string | null;
}): { id: string; esito: EsitoColloquio; valutazione: string } {
  const id = String(input.id || "").trim();
  if (!id || id.length > 80) throw new Error("Colloquio non indicato");
  const esitoRaw = String(input.esito || "").trim().toUpperCase();
  if (!isEsitoColloquio(esitoRaw)) throw new Error("Esito colloquio non valido");
  return { id, esito: esitoRaw, valutazione: validaNoteAttivita(input.valutazione) };
}

export function toColloquioRecord(row: {
  id: string;
  tenantId: string;
  candidaturaId: string;
  round: number;
  stato: string;
  scheduledAt: Date;
  modalita: string;
  intervistatoreUserId: string | null;
  intervistatoreLabel: string;
  notePreliminari: string;
  noteSvolgimento: string;
  esito: string | null;
  valutazione: string;
  valutazioneStelle?: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  intervistatore?: { name: string; cognome?: string | null } | null;
}): RecruitingColloquioRecord {
  const stato = isStatoColloquio(row.stato) ? row.stato : "PROGRAMMATO";
  const modalita = isModalitaColloquio(row.modalita) ? row.modalita : "PRESENZA";
  const esito = row.esito && isEsitoColloquio(row.esito) ? row.esito : null;
  const nomeIntervistatore = row.intervistatore
    ? [row.intervistatore.name, row.intervistatore.cognome].filter(Boolean).join(" ").trim()
    : "";
  const stelle =
    row.valutazioneStelle != null &&
    Number.isInteger(row.valutazioneStelle) &&
    row.valutazioneStelle >= 1 &&
    row.valutazioneStelle <= 5
      ? row.valutazioneStelle
      : null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    candidaturaId: row.candidaturaId,
    round: row.round,
    stato,
    scheduledAt: row.scheduledAt,
    modalita,
    intervistatoreUserId: row.intervistatoreUserId || null,
    intervistatoreLabel: row.intervistatoreLabel || "",
    intervistatoreNome: nomeIntervistatore || row.intervistatoreLabel || "—",
    notePreliminari: row.notePreliminari || "",
    noteSvolgimento: row.noteSvolgimento || "",
    esito,
    valutazione: row.valutazione || "",
    valutazioneStelle: stelle,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
  };
}
