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
  "PROVA_PROGRAMMATA",
  "PROVA_ESITO",
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
  PROVA_PROGRAMMATA: "Prova programmata",
  PROVA_ESITO: "Esito prova",
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

export function validaProvaInput(input: {
  candidaturaId?: string | null;
  scheduledAt?: string | null;
  modalita?: string | null;
  intervistatoreUserId?: string | null;
  intervistatoreLabel?: string | null;
  note?: string | null;
  notePreliminari?: string | null;
}): {
  candidaturaId: string;
  scheduledAt: Date;
  modalita: string;
  intervistatoreUserId: string;
  intervistatoreLabel: string;
  note: string;
} {
  const candidaturaId = String(input.candidaturaId || "").trim();
  if (!candidaturaId || candidaturaId.length > 80) throw new Error("Candidatura non indicata");
  const raw = String(input.scheduledAt || "").trim();
  if (!raw) throw new Error("Data e ora della prova obbligatorie");
  const modalitaRaw = String(input.modalita || "PRESENZA").trim().toUpperCase();
  if (!["PRESENZA", "VIDEO", "TELEFONO"].includes(modalitaRaw)) {
    throw new Error("Modalità non valida");
  }
  const intervistatoreUserId = String(input.intervistatoreUserId || "").trim();
  if (intervistatoreUserId.length > 80) throw new Error("Intervistatore non valido");
  const intervistatoreLabel = String(input.intervistatoreLabel || "").trim();
  if (intervistatoreLabel.length > 120) throw new Error("Referente troppo lungo");
  const noteBody = validaNoteAttivita(
    input.notePreliminari ?? input.note
  );
  return {
    candidaturaId,
    scheduledAt: parseOccurredAt(raw),
    modalita: modalitaRaw,
    intervistatoreUserId,
    intervistatoreLabel,
    note: noteBody,
  };
}

export function canCreateProva(statoCandidatura: StatoCandidatura): boolean {
  return statoCandidatura === "COLLOQUIO";
}

/** Esiti prova: stessi valori del colloquio. */
export const ESITI_PROVA = ["POSITIVO", "NEGATIVO", "DA_RIVALUTARE", "ASSENTE"] as const;
export type EsitoProva = (typeof ESITI_PROVA)[number];

export const ESITO_PROVA_LABELS: Record<EsitoProva, string> = {
  POSITIVO: "Positivo",
  NEGATIVO: "Negativo",
  DA_RIVALUTARE: "Da rivalutare",
  ASSENTE: "Assente",
};

export function isEsitoProva(value: string): value is EsitoProva {
  return (ESITI_PROVA as readonly string[]).includes(value);
}

export function validaEsitoProvaInput(input: {
  provaId?: string | null;
  esito?: string | null;
  parere?: string | null;
  valutazioneStelle?: string | number | null;
}): {
  provaId: string;
  esito: EsitoProva;
  parere: string;
  valutazioneStelle: number | null;
} {
  const provaId = String(input.provaId || "").trim();
  if (!provaId || provaId.length > 80) throw new Error("Prova non indicata");
  const esitoRaw = String(input.esito || "").trim().toUpperCase();
  if (!isEsitoProva(esitoRaw)) throw new Error("Esito prova non valido");
  const parereRaw = String(input.parere || "").trim();
  if (!parereRaw) throw new Error("Parere obbligatorio");
  const parere = validaNoteAttivita(parereRaw);
  let valutazioneStelle: number | null = null;
  const raw = input.valutazioneStelle;
  if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      throw new Error("Valutazione non valida (1–5)");
    }
    valutazioneStelle = n;
  }
  if (!valutazioneStelle) throw new Error("Valutazione obbligatoria");
  return { provaId, esito: esitoRaw, parere, valutazioneStelle };
}

export function encodeProvaEsitoNote(input: {
  valutazioneStelle: number;
  parere: string;
}): string {
  return [`Valutazione: ${input.valutazioneStelle}/5`, input.parere].filter(Boolean).join("\n").trim();
}

export function parseProvaEsitoNote(note: string): {
  valutazioneStelle: number | null;
  parere: string;
} {
  const text = String(note || "").trim();
  const m = text.match(/^Valutazione:\s*([1-5])\/5\s*(?:\n|$)/i);
  if (!m) return { valutazioneStelle: null, parere: text };
  const parere = text.slice(m[0].length).trim();
  return { valutazioneStelle: Number(m[1]), parere };
}

export type ProvaRow = {
  id: string;
  scheduledAt: Date;
  modalita: "PRESENZA" | "VIDEO" | "TELEFONO";
  modalitaLabel: string;
  affiancatore: string;
  notePreliminari: string;
  esito: EsitoProva | null;
  parere: string;
  valutazioneStelle: number | null;
  esitoAttivitaId: string | null;
};

export function buildProveRows(attivita: RecruitingAttivitaRecord[]): ProvaRow[] {
  const programmate = attivita
    .filter((a) => a.tipo === "PROVA_PROGRAMMATA")
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const esiti = attivita
    .filter((a) => a.tipo === "PROVA_ESITO")
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  return programmate.map((p, idx) => {
    const next = programmate[idx + 1];
    const byLink = [...esiti].reverse().find((e) => e.colloquioId === p.id) ?? null;
    const esitoAtt =
      byLink ??
      ([...esiti]
        .reverse()
        .find(
          (e) =>
            e.occurredAt.getTime() >= p.occurredAt.getTime() &&
            (!next || e.occurredAt.getTime() < next.occurredAt.getTime())
        ) ?? null);
    const lines = String(p.note || "").split("\n");
    const meta = lines[0] || "";
    const notePreliminari = lines.slice(1).join("\n").trim();
    const modalitaMatch = meta.match(/Modalità:\s*([^·]+)/i);
    const affMatch = meta.match(/Affiancatore:\s*(.+)$/i);
    const modalitaLabel = modalitaMatch?.[1]?.trim() || "—";
    const modalitaNorm = modalitaLabel.toLowerCase();
    const modalita: ProvaRow["modalita"] =
      modalitaNorm.includes("video")
        ? "VIDEO"
        : modalitaNorm.includes("telefon")
          ? "TELEFONO"
          : "PRESENZA";
    const parsed = esitoAtt ? parseProvaEsitoNote(esitoAtt.note) : null;
    const esitoRaw = esitoAtt?.esito || "";
    return {
      id: p.id,
      scheduledAt: p.occurredAt,
      modalita,
      modalitaLabel,
      affiancatore: affMatch?.[1]?.trim() || "—",
      notePreliminari,
      esito: isEsitoProva(esitoRaw) ? esitoRaw : null,
      parere: parsed?.parere || "",
      valutazioneStelle: parsed?.valutazioneStelle ?? null,
      esitoAttivitaId: esitoAtt?.id ?? null,
    };
  });
}

export function hasContattoRegistrato(attivita: Array<{ tipo: string }>): boolean {
  return attivita.some((a) => a.tipo === "CONTATTO");
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

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Ordine del percorso (per non far “tornare indietro” la sezione in elenco). */
const ORDINE_FASE: StatoCandidatura[] = [
  "RICEVUTA",
  "IN_VALUTAZIONE",
  "COLLOQUIO",
  "PROVA",
  "ASSUNTA",
];

function indiceFase(stato: StatoCandidatura): number {
  if (stato === "ARCHIVIATA") return ORDINE_FASE.length; // terminale, oltre il percorso
  const i = ORDINE_FASE.indexOf(stato);
  return i >= 0 ? i : 0;
}

function avanzaFase(corrente: StatoCandidatura, verso: StatoCandidatura): StatoCandidatura {
  if (verso === "ARCHIVIATA" || corrente === "ARCHIVIATA") return verso;
  return indiceFase(verso) >= indiceFase(corrente) ? verso : corrente;
}

/**
 * Stato del percorso al momento dell’attività (sezione in Contatti/Timeline).
 * Si ricostruisce dalla timeline (CAMBIO_STATO e eventi di fase), non dal solo
 * statoA salvato sull’evento: altrimenti un contatto con data successiva al
 * passaggio a Colloquio resterebbe etichettato «In valutazione».
 */
export function statoCandidaturaAlMomento(
  attivita: Array<{
    id: string;
    tipo: string;
    occurredAt: Date | string;
    statoA: StatoCandidatura | null;
  }>,
  evento: { id: string; occurredAt: Date | string; statoA?: StatoCandidatura | null }
): StatoCandidatura {
  const t = asDate(evento.occurredAt).getTime();
  const ordered = [...attivita].sort((a, b) => {
    const da = asDate(a.occurredAt).getTime();
    const db = asDate(b.occurredAt).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
  let stato: StatoCandidatura = "RICEVUTA";
  for (const a of ordered) {
    const ta = asDate(a.occurredAt).getTime();
    // Eventi strettamente precedenti (stesso istante: solo id minori = già avvenuti).
    if (ta > t || (ta === t && a.id.localeCompare(evento.id) >= 0)) break;

    if (a.tipo === "RICEZIONE") {
      stato = "RICEVUTA";
    } else if (a.tipo === "CAMBIO_STATO" && a.statoA) {
      stato = a.statoA;
    } else if (
      a.tipo === "COLLOQUIO_PROGRAMMATO" ||
      a.tipo === "COLLOQUIO_SVOLTO" ||
      a.tipo === "COLLOQUIO_ESITO"
    ) {
      stato = avanzaFase(stato, "COLLOQUIO");
    } else if (a.tipo === "PROVA_PROGRAMMATA" || a.tipo === "PROVA_ESITO") {
      stato = avanzaFase(stato, "PROVA");
    } else if (
      (a.tipo === "CONTATTO" || a.tipo === "NOTA") &&
      a.statoA &&
      a.statoA !== "ARCHIVIATA"
    ) {
      // Contatto/nota precedenti: usano la fase registrata solo per avanzare, mai per tornare indietro.
      stato = avanzaFase(stato, a.statoA);
    }
  }
  return stato;
}

/** Confronto per elenco: data/ora decrescente, poi id. */
export function confrontaAttivitaPerDataDesc(
  a: { id: string; occurredAt: Date | string },
  b: { id: string; occurredAt: Date | string }
): number {
  const db = asDate(b.occurredAt).getTime();
  const da = asDate(a.occurredAt).getTime();
  if (db !== da) return db - da;
  return b.id.localeCompare(a.id);
}

export function etichettaSezioneAttivita(
  attivita: Array<{
    id: string;
    tipo: string;
    occurredAt: Date | string;
    statoA: StatoCandidatura | null;
  }>,
  evento: { id: string; occurredAt: Date | string; statoA?: StatoCandidatura | null }
): string {
  return STATO_CANDIDATURA_LABELS[statoCandidaturaAlMomento(attivita, evento)];
}

export type SuggerimentoTransizione = {
  to?: StatoCandidatura;
  messaggio: string;
};

export type AttivitaPromptInput = {
  tipo: TipoAttivita;
  esito?: string | null;
  statoA?: StatoCandidatura | null;
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
    const lastEsitoProva =
      [...attivita].reverse().find((a) => a.tipo === "PROVA_ESITO" && a.esito)?.esito || null;
    if (lastEsitoProva === "NEGATIVO" || lastEsitoProva === "ASSENTE") {
      return { to: "ARCHIVIATA", messaggio: "Archiviare la candidatura?" };
    }
    if (lastEsitoProva === "POSITIVO") {
      return { to: "ASSUNTA", messaggio: "Passare ad Assunto/a?" };
    }
    if (!lastEsitoProva) {
      return { messaggio: "Registra l’esito della prova per valutare l’assunzione." };
    }
    return { messaggio: "Esito da rivalutare. Puoi aggiornare la prova oppure archiviare." };
  }

  if (stato === "COLLOQUIO") {
    if (lastEsitoColloquio === "DA_RIVALUTARE") {
      return { messaggio: "Esito da rivalutare. Puoi programmare un nuovo colloquio oppure la prova." };
    }
    return null;
  }

  if (stato === "IN_VALUTAZIONE" || stato === "RICEVUTA") {
    const lastContatto = [...attivita]
      .reverse()
      .find(
        (a) =>
          a.tipo === "CONTATTO" &&
          (a.statoA === "RICEVUTA" || a.statoA === "IN_VALUTAZIONE")
      );
    if (!lastContatto) {
      return {
        messaggio: "Contatta il candidato e programma il colloquio per avanzare.",
      };
    }
    if (lastContatto.esito === "RIFIUTA") {
      return { to: "ARCHIVIATA", messaggio: "Il candidato ha rifiutato. Archiviare la candidatura?" };
    }
    if (lastContatto.esito === "NON_RAGGIUNTO") {
      return {
        messaggio:
          "Candidato non raggiunto. Puoi riprovare il contatto oppure archiviare la candidatura.",
      };
    }
    if (lastContatto.esito === "DA_RICHIAMARE") {
      return {
        messaggio: "Candidato da richiamare. Aggiorna il contatto quando lo contatti di nuovo.",
      };
    }
    return {
      messaggio:
        "Candidato raggiunto: programma il colloquio con data e ora per passare a Colloquio.",
    };
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
