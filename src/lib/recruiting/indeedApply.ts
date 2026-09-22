/**
 * DTO Indeed Apply (in memoria).
 * Il receiver potrà restituire questo payload a Credixa.
 * Nessuna persistenza: non mappare 1:1 su tabella DB.
 * Nessun contenuto CV / Base64 / binario.
 */

/** Metadati CV/documento sul receiver — mai il file. */
export type IndeedApplyResumeMeta = {
  /** True se Indeed/receiver segnala un CV allegato. */
  present: boolean;
  fileName?: string | null;
  contentType?: string | null;
  /** Id documento lato receiver / Indeed (riferimento, non blob). */
  documentId?: string | null;
  /** Ref/URL autorizzata sul receiver per apertura futura. */
  receiverDocumentRef?: string | null;
};

/** Domanda/risposta screening Indeed (estendibile). */
export type IndeedApplyScreenerQuestion = {
  id?: string | null;
  question?: string | null;
  type?: string | null;
  answer?: string | string[] | number | boolean | null;
  /** Campi aggiuntivi Indeed senza toccare il modello Credixa. */
  [key: string]: unknown;
};

/**
 * Payload application Indeed Apply (estendibile via `extensions`).
 * Campi allineati alla nomenclatura tipica Indeed; tutti opzionali
 * tranne che in fase di mapping (validati lì).
 */
export type IndeedApplyApplication = {
  // --- Identificazione ---
  applicationId?: string | null;
  jobId?: string | null;

  // --- Candidato ---
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phoneNumber?: string | null;

  // --- Candidatura ---
  /** Indeed usa spesso `coverletter` (una sola parola). */
  coverletter?: string | null;

  // --- CV: solo metadati (NO data/base64/html/text) ---
  resume?: IndeedApplyResumeMeta | null;

  // --- Screening ---
  screenerQuestions?: IndeedApplyScreenerQuestion[] | null;

  // --- Job meta ---
  jobMeta?: Record<string, unknown> | null;

  // --- Source / analytics ---
  source?: string | null;
  analytics?: Record<string, unknown> | null;

  /**
   * Estensioni future Indeed/receiver senza cambiare
   * RecruitingCandidaturaReceiverUpsertInput.
   */
  extensions?: Record<string, unknown> | null;
};

/** Codici errore mapping (identificabili dal caller). */
export type IndeedApplyMappingErrorCode =
  | "MISSING_TENANT_ID"
  | "MISSING_APPLICATION_ID"
  | "MISSING_JOB_ID"
  | "OFFERTA_NOT_FOUND"
  | "MISSING_CANDIDATE_NAME";

export class IndeedApplyMappingError extends Error {
  readonly code: IndeedApplyMappingErrorCode;

  constructor(code: IndeedApplyMappingErrorCode, message: string) {
    super(message);
    this.name = "IndeedApplyMappingError";
    this.code = code;
  }
}

export function isIndeedApplyMappingError(
  err: unknown
): err is IndeedApplyMappingError {
  return err instanceof IndeedApplyMappingError;
}
