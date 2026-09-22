/** Configurazione tecnica del ricevitore aziendale. Nessun dato candidato/CV/Indeed secret. */

export const STATI_RECEIVER_CONFIG = ["DISCONNECTED", "ACTIVE", "ERROR"] as const;

export type StatoReceiverConfig = (typeof STATI_RECEIVER_CONFIG)[number];

export const STATO_RECEIVER_CONFIG_LABELS: Record<StatoReceiverConfig, string> = {
  DISCONNECTED: "Non connesso",
  ACTIVE: "Attivo",
  ERROR: "Errore",
};

export type RecruitingReceiverConfigRecord = {
  id: string;
  tenantId: string;
  baseUrl: string;
  status: StatoReceiverConfig;
  sourceName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type RecruitingReceiverConfigWriteInput = {
  baseUrl: string;
  sourceName: string;
};

/** Metadati CV sul Receiver — mai contenuto file/Base64. */
export type ReceiverResumeMeta = {
  present: boolean;
  fileName?: string | null;
  contentType?: string | null;
  documentId?: string | null;
  /** Dimensione in byte se nota (non sensibile). */
  sizeBytes?: number | null;
};

/**
 * Candidatura così come restituita dal Receiver aziendale.
 * `cvRef` = riferimento documento sul Receiver, non il file.
 */
export type ReceiverCandidate = {
  receiverCandidateId: string;
  externalApplicationId: string;
  indeedJobId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  coverLetter?: string | null;
  receivedAt?: string | null;
  resumeMeta?: ReceiverResumeMeta | null;
  /** Riferimento documento CV sul Receiver (id/path), non URL permanente né blob. */
  cvRef?: string | null;
};

export type ReceiverSyncStatus = {
  ok: boolean;
  lastSyncAt?: string | null;
  pendingCount?: number | null;
  message?: string | null;
};

/** Risposta apertura CV: URL temporaneo autorizzato dal Receiver. Non salvare in Credixa. */
export type ReceiverCvOpenResult = {
  openUrl: string;
  expiresAt?: string | null;
  fileName?: string | null;
  contentType?: string | null;
};

export type ReceiverClientErrorCode =
  | "NOT_CONFIGURED"
  | "OFFLINE"
  | "AUTH_FAILED"
  | "TENANT_UNAUTHORIZED"
  | "CANDIDATE_NOT_FOUND"
  | "CV_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "HTTPS_REQUIRED"
  | "HTTP_ERROR";

export class ReceiverClientError extends Error {
  readonly code: ReceiverClientErrorCode;
  readonly status?: number;

  constructor(code: ReceiverClientErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ReceiverClientError";
    this.code = code;
    this.status = status;
  }
}

export function isReceiverClientError(err: unknown): err is ReceiverClientError {
  return err instanceof ReceiverClientError;
}

/** Messaggio sicuro per UI/client (niente dettagli tecnici/secret). */
export function receiverErrorPublicMessage(err: ReceiverClientError): string {
  switch (err.code) {
    case "NOT_CONFIGURED":
      return "Ricevitore non configurato";
    case "OFFLINE":
      return "Ricevitore non raggiungibile";
    case "AUTH_FAILED":
      return "Autenticazione verso il ricevitore non riuscita";
    case "TENANT_UNAUTHORIZED":
      return "Tenant non autorizzato sul ricevitore";
    case "CANDIDATE_NOT_FOUND":
      return "Candidatura non trovata sul ricevitore";
    case "CV_UNAVAILABLE":
      return "CV non disponibile";
    case "TIMEOUT":
      return "Timeout nella comunicazione con il ricevitore";
    case "HTTPS_REQUIRED":
      return "Il ricevitore deve usare HTTPS";
    case "INVALID_RESPONSE":
      return "Risposta del ricevitore non valida";
    default:
      return "Errore di comunicazione con il ricevitore";
  }
}

const BASE_URL_MAX = 500;
const SOURCE_NAME_MAX = 80;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "169.254.169.254",
  "metadata.google.internal",
]);

const SENSITIVE_QUERY_RE = /^(token|secret|password|passwd|pwd|api[_-]?key|credential|access[_-]?key|auth)$/i;

export function isStatoReceiverConfig(value: string): value is StatoReceiverConfig {
  return (STATI_RECEIVER_CONFIG as readonly string[]).includes(value);
}

export function validaReceiverSourceName(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > SOURCE_NAME_MAX) throw new Error("Etichetta tecnica troppo lunga");
  if (!/^[A-Za-z0-9._:-]+$/.test(raw)) {
    throw new Error("Etichetta tecnica: usare solo lettere, numeri, . _ : -");
  }
  return raw;
}

export function validaReceiverBaseUrl(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("URL ricevitore obbligatorio");
  if (raw.length > BASE_URL_MAX) throw new Error("URL troppo lungo");
  if (/\s/.test(raw)) throw new Error("URL non valido");
  if (/^(javascript|data|file|ftp|ws|wss|http):/i.test(raw)) {
    throw new Error("L'URL deve usare HTTPS");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("URL non valido");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("L'URL deve usare HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new Error("L'URL non può contenere credenziali");
  }
  if (!parsed.hostname) throw new Error("URL non valido");
  if (parsed.hash && parsed.hash !== "#") {
    throw new Error("URL non valido");
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(parsed.hostname.toLowerCase()) || host.endsWith(".localhost")) {
    throw new Error("Host non consentito");
  }
  if (host.startsWith("127.") || host.startsWith("169.254.") || host === "::1" || host.startsWith("fe80:")) {
    throw new Error("Host non consentito");
  }

  for (const key of parsed.searchParams.keys()) {
    if (SENSITIVE_QUERY_RE.test(key)) {
      throw new Error("L'URL non può contenere dati sensibili");
    }
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${path}${parsed.search}`;
}

/**
 * Validazione URL per richieste client Receiver.
 * In produzione richiede HTTPS; in sviluppo consente anche http://localhost per test locali.
 */
export function assertReceiverRequestBaseUrl(
  value: string | null | undefined,
  opts?: { production?: boolean }
): string {
  const production =
    opts?.production ?? process.env.NODE_ENV === "production";
  const raw = String(value || "").trim();
  if (!raw) {
    throw new ReceiverClientError("NOT_CONFIGURED", "URL ricevitore mancante");
  }
  if (production) {
    try {
      return validaReceiverBaseUrl(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "URL non valido";
      if (/HTTPS/i.test(msg)) {
        throw new ReceiverClientError("HTTPS_REQUIRED", msg);
      }
      throw new ReceiverClientError("NOT_CONFIGURED", msg);
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ReceiverClientError("NOT_CONFIGURED", "URL ricevitore non valido");
  }
  if (parsed.protocol === "https:") {
    return validaReceiverBaseUrl(raw);
  }
  if (
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${path}`;
  }
  throw new ReceiverClientError(
    "HTTPS_REQUIRED",
    "In sviluppo usare HTTPS oppure http://localhost"
  );
}

export function validaReceiverConfigInput(input: {
  baseUrl?: string | null;
  sourceName?: string | null;
}): RecruitingReceiverConfigWriteInput {
  return {
    baseUrl: validaReceiverBaseUrl(input.baseUrl),
    sourceName: validaReceiverSourceName(input.sourceName),
  };
}

export function toReceiverConfigRecord(row: {
  id: string;
  tenantId: string;
  baseUrl: string;
  status: string;
  sourceName: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RecruitingReceiverConfigRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    baseUrl: row.baseUrl,
    status: isStatoReceiverConfig(row.status) ? row.status : "DISCONNECTED",
    sourceName: row.sourceName || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const FORBIDDEN_RESUME_KEYS = new Set([
  "data",
  "content",
  "base64",
  "file",
  "bytes",
  "buffer",
  "resumehtml",
  "resumetext",
  "resumejson",
  "binary",
]);

function trimOrNull(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

/** Normalizza metadati CV scartando chiavi di contenuto. */
export function normalizeReceiverResumeMeta(raw: unknown): ReceiverResumeMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const present = Boolean(obj.present);
  const fileName = trimOrNull(obj.fileName ?? obj.filename);
  const contentType = trimOrNull(obj.contentType ?? obj.mimeType);
  const documentId = trimOrNull(obj.documentId ?? obj.document_id);
  const sizeRaw = obj.sizeBytes ?? obj.size;
  const sizeBytes =
    typeof sizeRaw === "number" && Number.isFinite(sizeRaw) && sizeRaw >= 0
      ? Math.floor(sizeRaw)
      : null;
  if (!present && !fileName && !contentType && !documentId && sizeBytes == null) {
    return null;
  }
  return { present, fileName, contentType, documentId, sizeBytes };
}

/** Normalizza una candidatura Receiver; rifiuta payload con contenuto CV. */
export function normalizeReceiverCandidate(raw: unknown): ReceiverCandidate {
  if (!raw || typeof raw !== "object") {
    throw new ReceiverClientError("INVALID_RESPONSE", "Candidatura Receiver non valida");
  }
  const obj = raw as Record<string, unknown>;
  const receiverCandidateId = trimOrNull(obj.receiverCandidateId ?? obj.id);
  const externalApplicationId = trimOrNull(
    obj.externalApplicationId ?? obj.applicationId
  );
  const indeedJobId = trimOrNull(obj.indeedJobId ?? obj.jobId);
  if (!receiverCandidateId || !externalApplicationId || !indeedJobId) {
    throw new ReceiverClientError(
      "INVALID_RESPONSE",
      "Candidatura Receiver incompleta"
    );
  }
  const resume = obj.resume ?? obj.cv ?? obj.resumeMeta;
  if (resume && typeof resume === "object") {
    for (const key of Object.keys(resume as object)) {
      if (FORBIDDEN_RESUME_KEYS.has(key.toLowerCase())) {
        throw new ReceiverClientError(
          "INVALID_RESPONSE",
          "Risposta Receiver contiene contenuto CV non consentito"
        );
      }
    }
  }
  if (typeof obj.resumeData === "string" || typeof obj.base64 === "string") {
    throw new ReceiverClientError(
      "INVALID_RESPONSE",
      "Risposta Receiver contiene contenuto CV non consentito"
    );
  }

  return {
    receiverCandidateId,
    externalApplicationId,
    indeedJobId,
    firstName: trimOrNull(obj.firstName),
    lastName: trimOrNull(obj.lastName),
    email: trimOrNull(obj.email),
    emailVerified:
      obj.emailVerified === true || obj.emailVerified === false
        ? obj.emailVerified
        : null,
    phone: trimOrNull(obj.phone ?? obj.phoneNumber),
    coverLetter: trimOrNull(obj.coverLetter ?? obj.coverletter),
    receivedAt: trimOrNull(obj.receivedAt),
    resumeMeta: normalizeReceiverResumeMeta(obj.resumeMeta ?? obj.resume),
    cvRef: trimOrNull(obj.cvRef ?? obj.cv_ref),
  };
}
