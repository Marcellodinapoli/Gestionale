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
