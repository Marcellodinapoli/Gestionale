/** Attività candidatura: registro append-only. Nessun PII/CV/payload Receiver. */

import {
  isStatoCandidatura,
  isTransizioneCandidaturaConsentita,
  STATO_CANDIDATURA_LABELS,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";

export const TIPI_ATTIVITA = [
  "RICEZIONE",
  "CONTATTO",
  "NOTA",
  "COLLOQUIO_PROGRAMMATO",
  "COLLOQUIO_SVOLTO",
  "COLLOQUIO_ESITO",
  "COLLOQUIO_ANNULLATO",
  "CAMBIO_STATO",
] as const;

export type TipoAttivita = (typeof TIPI_ATTIVITA)[number];

export const TIPO_ATTIVITA_LABELS: Record<TipoAttivita, string> = {
  RICEZIONE: "Ricezione",
  CONTATTO: "Contatto",
  NOTA: "Nota",
  COLLOQUIO_PROGRAMMATO: "Colloquio programmato",
  COLLOQUIO_SVOLTO: "Colloquio svolto",
  COLLOQUIO_ESITO: "Esito colloquio",
  COLLOQUIO_ANNULLATO: "Colloquio annullato",
  CAMBIO_STATO: "Cambio stato",
};

export const ESITI_CONTATTO = [
  "RAGGIUNTO",
  "NON_RAGGIUNTO",
  "DA_RICHIAMARE",
  "RIFIUTA",
] as const;

export type EsitoContatto = (typeof ESITI_CONTATTO)[number];

export const ESITO_CONTATTO_LABELS: Record<EsitoContatto, string> = {
  RAGGIUNTO: "Raggiunto",
  NON_RAGGIUNTO: "Non raggiunto",
  DA_RICHIAMARE: "Da richiamare",
  RIFIUTA: "Rifiuta",
};

export const CANALI_CONTATTO = ["TELEFONO", "VIDEO", "ALTRO"] as const;

export type CanaleContatto = (typeof CANALI_CONTATTO)[number];

export const CANALE_CONTATTO_LABELS: Record<CanaleContatto, string> = {
  TELEFONO: "Telefono",
  VIDEO: "Video",
  ALTRO: "Altro",
};

export type RecruitingAttivitaRecord = {
  id: string;
  tenantId: string;
  candidaturaId: string;
  tipo: TipoAttivita;
  occurredAt: Date;
  note: string;
  esito: string | null;
  statoDa: StatoCandidatura | null;
  statoA: StatoCandidatura | null;
  colloquioId: string | null;
  canale: CanaleContatto | null;
  createdAt: Date;
  createdById: string;
  createdByName: string;
};

const NOTE_MAX = 2000;

export function isTipoAttivita(value: string): value is TipoAttivita {
  return (TIPI_ATTIVITA as readonly string[]).includes(value);
}

export function isEsitoContatto(value: string): value is EsitoContatto {
  return (ESITI_CONTATTO as readonly string[]).includes(value);
}

export function isCanaleContatto(value: string): value is CanaleContatto {
  return (CANALI_CONTATTO as readonly string[]).includes(value);
}

export function parseOccurredAt(value: string | null | undefined): Date {
  const raw = String(value || "").trim();
  if (!raw) return new Date();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data/ora non valida");
  return parsed;
}

export function validaNoteAttivita(value: string | null | undefined, required = false): string {
  const raw = String(value || "").trim();
  if (required && !raw) throw new Error("Nota obbligatoria");
  if (raw.length > NOTE_MAX) throw new Error("Nota troppo lunga");
  return raw;
}

export function validaContattoInput(input: {
  candidaturaId?: string | null;
  canale?: string | null;
  esito?: string | null;
  occurredAt?: string | null;
  note?: string | null;
}): {
  candidaturaId: string;
  canale: CanaleContatto;
  esito: EsitoContatto;
  occurredAt: Date;
  note: string;
} {
  const candidaturaId = String(input.candidaturaId || "").trim();
  if (!candidaturaId || candidaturaId.length > 80) throw new Error("Candidatura non indicata");
  const canaleRaw = String(input.canale || "").trim().toUpperCase();
  if (!isCanaleContatto(canaleRaw)) throw new Error("Canale contatto non valido");
  const esitoRaw = String(input.esito || "").trim().toUpperCase();
  if (!isEsitoContatto(esitoRaw)) throw new Error("Esito contatto non valido");
  return {
    candidaturaId,
    canale: canaleRaw,
    esito: esitoRaw,
    occurredAt: parseOccurredAt(input.occurredAt),
    note: validaNoteAttivita(input.note),
  };
}

export function validaNotaInput(input: {
  candidaturaId?: string | null;
  occurredAt?: string | null;
  note?: string | null;
}): { candidaturaId: string; occurredAt: Date; note: string } {
  const candidaturaId = String(input.candidaturaId || "").trim();
  if (!candidaturaId || candidaturaId.length > 80) throw new Error("Candidatura non indicata");
  return {
    candidaturaId,
    occurredAt: parseOccurredAt(input.occurredAt),
    note: validaNoteAttivita(input.note, true),
  };
}

export function toAttivitaRecord(row: {
  id: string;
  tenantId: string;
  candidaturaId: string;
  tipo: string;
  occurredAt: Date;
  note: string;
  esito: string | null;
  statoDa: string | null;
  statoA: string | null;
  colloquioId: string | null;
  canale: string | null;
  createdAt: Date;
  createdById: string;
  createdBy?: { name: string; cognome?: string | null } | null;
}): RecruitingAttivitaRecord {
  const tipo = isTipoAttivita(row.tipo) ? row.tipo : "NOTA";
  const canale = row.canale && isCanaleContatto(row.canale) ? row.canale : null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    candidaturaId: row.candidaturaId,
    tipo,
    occurredAt: row.occurredAt,
    note: row.note || "",
    esito: row.esito || null,
    statoDa: row.statoDa && isStatoCandidatura(row.statoDa) ? row.statoDa : null,
    statoA: row.statoA && isStatoCandidatura(row.statoA) ? row.statoA : null,
    colloquioId: row.colloquioId || null,
    canale,
    createdAt: row.createdAt,
    createdById: row.createdById,
    createdByName: formatAutore(row.createdBy),
  };
}

export function formatAutore(user?: { name: string; cognome?: string | null } | null): string {
  if (!user) return "—";
  return [user.name, user.cognome].filter(Boolean).join(" ").trim() || "—";
}

export type SuggerimentoTransizione = {
  to?: StatoCandidatura;
  messaggio: string;
};

export type AttivitaPromptInput = {
  tipo: TipoAttivita;
  esito?: string | null;
};

export function suggerimentoTransizioneCandidatura(input: {
  stato: StatoCandidatura;
  attivita: AttivitaPromptInput[];
}): SuggerimentoTransizione | null {
  const { stato, attivita } = input;
  if (stato === "ASSUNTA" || stato === "ARCHIVIATA") return null;

  const lastEsitoColloquio =
    [...attivita].reverse().find((a) => a.tipo === "COLLOQUIO_ESITO" && a.esito)?.esito || null;

  if (
    (lastEsitoColloquio === "NEGATIVO" || lastEsitoColloquio === "ASSENTE") &&
    isTransizioneCandidaturaConsentita(stato, "ARCHIVIATA")
  ) {
    return { to: "ARCHIVIATA", messaggio: "Archiviare la candidatura?" };
  }

  if (stato === "PROVA") {
    return { to: "ASSUNTA", messaggio: "Passare ad Assunto/a?" };
  }

  if (stato === "COLLOQUIO" && lastEsitoColloquio === "POSITIVO") {
    return { to: "PROVA", messaggio: "Passare a Prova?" };
  }

  if (stato === "IN_VALUTAZIONE" && lastEsitoColloquio === "POSITIVO") {
    return {
      to: "COLLOQUIO",
      messaggio:
        "Il colloquio ha esito positivo. Passa prima a Colloquio; poi potrai impostare Prova e Assunto/a.",
    };
  }

  if (
    (stato === "IN_VALUTAZIONE" || stato === "COLLOQUIO") &&
    lastEsitoColloquio === "DA_RIVALUTARE"
  ) {
    return { messaggio: "Esito da rivalutare. Puoi programmare un nuovo colloquio." };
  }

  if (stato === "IN_VALUTAZIONE" && attivita.some((a) => a.tipo === "COLLOQUIO_PROGRAMMATO")) {
    return {
      to: "COLLOQUIO",
      messaggio: "Il colloquio è stato programmato. Vuoi passare la candidatura a Colloquio?",
    };
  }

  if (stato === "RICEVUTA") {
    const lastContatto = [...attivita].reverse().find((a) => a.tipo === "CONTATTO");
    const hasNota = attivita.some((a) => a.tipo === "NOTA");
    if (lastContatto?.esito === "RIFIUTA") {
      return { to: "ARCHIVIATA", messaggio: "Archiviare la candidatura?" };
    }
    if (hasNota || lastContatto?.esito === "RAGGIUNTO" || lastContatto?.esito === "NON_RAGGIUNTO") {
      return { to: "IN_VALUTAZIONE", messaggio: "Passare a In valutazione?" };
    }
    if (lastContatto?.esito === "DA_RICHIAMARE") return null;
  }

  return null;
}

export function messaggioConfermaStatoTerminale(
  to: "ASSUNTA" | "ARCHIVIATA",
  hasColloquiAperti: boolean
): string {
  const base =
    to === "ASSUNTA"
      ? "Il passaggio ad Assunto/a è definitivo e non reversibile. Confermi?"
      : "L'archiviazione è definitiva e non reversibile. Confermi?";
  if (!hasColloquiAperti) return base;
  return `${base} Esistono colloqui ancora aperti. Vuoi comunque chiudere la candidatura?`;
}

export const MESSAGGIO_CONFERMA_ANNULLA_COLLOQUIO =
  "L'annullamento del colloquio è definitivo e non reversibile. Confermi?";

export function etichettaCambioStato(
  statoDa: StatoCandidatura | null,
  statoA: StatoCandidatura | null
): string {
  const da = statoDa ? STATO_CANDIDATURA_LABELS[statoDa] : "—";
  const a = statoA ? STATO_CANDIDATURA_LABELS[statoA] : "—";
  return `${da} → ${a}`;
}
