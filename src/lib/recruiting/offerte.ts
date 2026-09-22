/** Stati e contenuti offerta di lavoro (Recruiting). Allineati a Indeed Job Sync body, senza sync. */

export const STATI_OFFERTA_LAVORO = ["BOZZA", "PUBBLICATA", "CHIUSA"] as const;

export type StatoOffertaLavoro = (typeof STATI_OFFERTA_LAVORO)[number];

export const STATO_OFFERTA_LAVORO_LABELS: Record<StatoOffertaLavoro, string> = {
  BOZZA: "Bozza",
  PUBBLICATA: "Pubblicata",
  CHIUSA: "Chiusa",
};

/**
 * Dicitura obbligatoria negli annunci/selezioni (datori privati e PA).
 * Testo normativo: D.Lgs. 11 aprile 2006, n. 198, art. 27 comma 5
 * («dell'uno o dell'altro sesso»). La L. 9 dicembre 1977, n. 903 è la fonte
 * originaria, oggi assorbita nel Codice delle pari opportunità.
 */
export const DICITURA_PARI_OPPORTUNITA =
  "La ricerca è rivolta a candidati dell'uno o dell'altro sesso (L. 903/1977 e D.Lgs. 198/2006, art. 27).";

/** Indeed remoteType: REMOTO → Fully Remote. */
export const MODALITA_LAVORO = ["PRESENZA", "IBRIDO", "REMOTO"] as const;
export type ModalitaLavoro = (typeof MODALITA_LAVORO)[number];
export const MODALITA_LAVORO_LABELS: Record<ModalitaLavoro, string> = {
  PRESENZA: "In presenza",
  IBRIDO: "Ibrido",
  REMOTO: "Da remoto",
};

/**
 * Indeed taxonomyClassification.jobTypes (SUID):
 * TEMPO_INDETERMINATO → 5QWDV Permanent
 * TEMPO_DETERMINATO → T9BXE Fixed term
 * STAGE → VDTG7 Internship
 * COLLABORAZIONE → T65DZ Project contract
 */
export const TIPI_CONTRATTO = [
  "TEMPO_INDETERMINATO",
  "TEMPO_DETERMINATO",
  "APPRENDISTATO",
  "STAGE",
  "COLLABORAZIONE",
] as const;
export type TipoContratto = (typeof TIPI_CONTRATTO)[number];
export const TIPO_CONTRATTO_LABELS: Record<TipoContratto, string> = {
  TEMPO_INDETERMINATO: "Tempo indeterminato",
  TEMPO_DETERMINATO: "Tempo determinato",
  APPRENDISTATO: "Apprendistato",
  STAGE: "Stage",
  COLLABORAZIONE: "Collaborazione / progetto",
};

/** Indeed: Part-time = jobTypes 75GKK; full-time di solito Permanent. */
export const ORARI_LAVORO = ["FULL_TIME", "PART_TIME", "TURNO"] as const;
export type OrarioLavoro = (typeof ORARI_LAVORO)[number];
export const ORARIO_LAVORO_LABELS: Record<OrarioLavoro, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  TURNO: "Turni",
};

export type OffertaLavoroRecord = {
  id: string;
  tenantId: string;
  titolo: string;
  luogo: string;
  modalitaLavoro: ModalitaLavoro;
  tipoContratto: TipoContratto | "";
  orario: OrarioLavoro | "";
  numeroPosizioni: number;
  descrizione: string;
  attivitaPrincipali: string;
  requisiti: string;
  competenze: string;
  retribuzione: string;
  benefit: string;
  paese: string;
  stato: StatoOffertaLavoro;
  indeedJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OffertaLavoroWriteInput = {
  titolo: string;
  luogo: string;
  modalitaLavoro: ModalitaLavoro;
  tipoContratto: TipoContratto | "";
  orario: OrarioLavoro | "";
  numeroPosizioni: number;
  descrizione: string;
  attivitaPrincipali: string;
  requisiti: string;
  competenze: string;
  retribuzione: string;
  benefit: string;
  stato?: StatoOffertaLavoro;
};

const TITOLO_MAX = 200;
const LUOGO_MAX = 200;
const TESTO_MAX = 20000;
const RETRIBUZIONE_MAX = 500;
const INDEED_DESCRIZIONE_MIN = 30;

export function isStatoOffertaLavoro(value: string): value is StatoOffertaLavoro {
  return (STATI_OFFERTA_LAVORO as readonly string[]).includes(value);
}

export function isModalitaLavoro(value: string): value is ModalitaLavoro {
  return (MODALITA_LAVORO as readonly string[]).includes(value);
}

export function isTipoContratto(value: string): value is TipoContratto {
  return (TIPI_CONTRATTO as readonly string[]).includes(value);
}

export function isOrarioLavoro(value: string): value is OrarioLavoro {
  return (ORARI_LAVORO as readonly string[]).includes(value);
}

export function parseStatoOffertaScrivibile(value: string | null | undefined): StatoOffertaLavoro {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "BOZZA";
  if (raw === "CHIUSA") return "CHIUSA";
  if (raw === "BOZZA" || raw === "PUBBLICATA") return raw;
  throw new Error("Stato offerta non valido");
}

/** Transizioni ammesse: BOZZA↔BOZZA, BOZZA→PUBBLICATA, PUBBLICATA→PUBBLICATA, CHIUSA→CHIUSA, *→CHIUSA. */
export function assertTransizioneOfferta(
  from: StatoOffertaLavoro,
  to: StatoOffertaLavoro
) {
  if (from === to) return;
  if (from === "CHIUSA") {
    throw new Error("Offerta chiusa: lo stato non si può riaprire da qui");
  }
  if (to === "CHIUSA") return;
  if (from === "BOZZA" && to === "PUBBLICATA") return;
  throw new Error("Transizione di stato non consentita");
}

export function assertOffertaApertaPerCandidature(stato: StatoOffertaLavoro): void {
  if (stato === "CHIUSA") {
    throw new Error("Non è possibile creare candidature su un'offerta chiusa");
  }
}

function trimMax(value: string | null | undefined, max: number, label: string): string {
  const raw = String(value || "").trim();
  if (raw.length > max) throw new Error(`${label} troppo lunga`);
  return raw;
}

export function validaOffertaLavoroInput(input: {
  titolo?: string | null;
  luogo?: string | null;
  modalitaLavoro?: string | null;
  tipoContratto?: string | null;
  orario?: string | null;
  numeroPosizioni?: string | number | null;
  descrizione?: string | null;
  attivitaPrincipali?: string | null;
  requisiti?: string | null;
  competenze?: string | null;
  retribuzione?: string | null;
  benefit?: string | null;
  stato?: string | null;
}): OffertaLavoroWriteInput {
  const titolo = String(input.titolo || "").trim();
  if (!titolo) throw new Error("Titolo obbligatorio");
  if (titolo.length > TITOLO_MAX) throw new Error("Titolo troppo lungo");

  const modalitaRaw = String(input.modalitaLavoro || "").trim().toUpperCase();
  if (!isModalitaLavoro(modalitaRaw)) throw new Error("Modalità di lavoro obbligatoria");

  const luogo = String(input.luogo || "").trim();
  if (!luogo) throw new Error("Sede obbligatoria");
  if (luogo.length > LUOGO_MAX) throw new Error("Sede troppo lunga");

  const tipoRaw = String(input.tipoContratto || "").trim().toUpperCase();
  const tipoContratto = tipoRaw ? (isTipoContratto(tipoRaw) ? tipoRaw : null) : "";
  if (tipoRaw && tipoContratto === null) throw new Error("Tipo contratto non valido");

  const orarioRaw = String(input.orario || "").trim().toUpperCase();
  const orario = orarioRaw ? (isOrarioLavoro(orarioRaw) ? orarioRaw : null) : "";
  if (orarioRaw && orario === null) throw new Error("Orario non valido");

  const posizioni = Number(input.numeroPosizioni ?? 1);
  if (!Number.isInteger(posizioni) || posizioni < 1 || posizioni > 999) {
    throw new Error("Numero posizioni non valido");
  }

  const descrizione = trimMax(input.descrizione, TESTO_MAX, "Descrizione");
  const stato = parseStatoOffertaScrivibile(input.stato);
  if (!descrizione) throw new Error("Descrizione obbligatoria");
  if (stato === "PUBBLICATA" && descrizione.length < INDEED_DESCRIZIONE_MIN) {
    throw new Error("Per pubblicare servono almeno 30 caratteri di descrizione");
  }

  return {
    titolo,
    luogo,
    modalitaLavoro: modalitaRaw,
    tipoContratto: tipoContratto || "",
    orario: orario || "",
    numeroPosizioni: posizioni,
    descrizione,
    attivitaPrincipali: trimMax(input.attivitaPrincipali, TESTO_MAX, "Attività principali"),
    requisiti: trimMax(input.requisiti, TESTO_MAX, "Requisiti"),
    competenze: trimMax(input.competenze, TESTO_MAX, "Competenze"),
    retribuzione: trimMax(input.retribuzione, RETRIBUZIONE_MAX, "Retribuzione"),
    benefit: trimMax(input.benefit, TESTO_MAX, "Benefit"),
    stato,
  };
}

export function toOffertaLavoroRecord(row: {
  id: string;
  tenantId: string;
  titolo: string;
  luogo: string;
  modalitaLavoro?: string | null;
  tipoContratto?: string | null;
  orario?: string | null;
  numeroPosizioni?: number | null;
  descrizione?: string | null;
  attivitaPrincipali?: string | null;
  requisiti?: string | null;
  competenze?: string | null;
  retribuzione?: string | null;
  benefit?: string | null;
  paese?: string | null;
  stato: string;
  indeedJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OffertaLavoroRecord {
  const stato = isStatoOffertaLavoro(row.stato) ? row.stato : "BOZZA";
  const modalita = isModalitaLavoro(String(row.modalitaLavoro || ""))
    ? (row.modalitaLavoro as ModalitaLavoro)
    : "PRESENZA";
  const tipoRaw = String(row.tipoContratto || "");
  const orarioRaw = String(row.orario || "");
  return {
    id: row.id,
    tenantId: row.tenantId,
    titolo: row.titolo,
    luogo: row.luogo || "",
    modalitaLavoro: modalita,
    tipoContratto: isTipoContratto(tipoRaw) ? tipoRaw : "",
    orario: isOrarioLavoro(orarioRaw) ? orarioRaw : "",
    numeroPosizioni: row.numeroPosizioni && row.numeroPosizioni > 0 ? row.numeroPosizioni : 1,
    descrizione: row.descrizione || "",
    attivitaPrincipali: row.attivitaPrincipali || "",
    requisiti: row.requisiti || "",
    competenze: row.competenze || "",
    retribuzione: row.retribuzione || "",
    benefit: row.benefit || "",
    paese: row.paese || "IT",
    stato,
    indeedJobId: row.indeedJobId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
