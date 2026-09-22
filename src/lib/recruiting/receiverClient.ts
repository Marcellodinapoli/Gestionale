import "server-only";
import {
  assertReceiverRequestBaseUrl,
  normalizeReceiverCandidate,
  ReceiverClientError,
  type ReceiverCandidate,
  type ReceiverCvOpenResult,
  type ReceiverSyncStatus,
  type RecruitingReceiverConfigRecord,
} from "@/lib/recruiting/receiver";
import {
  defaultReceiverAuthProvider,
  type ReceiverAuthProvider,
} from "@/lib/recruiting/receiverAuth";
import { getReceiverConfig } from "@/lib/recruiting/receiverRepo";

const DEFAULT_TIMEOUT_MS = 12_000;

export type ReceiverClientDeps = {
  getConfig?: (tenantId: string) => Promise<RecruitingReceiverConfigRecord | null>;
  auth?: ReceiverAuthProvider;
  fetch?: typeof fetch;
  timeoutMs?: number;
  production?: boolean;
};

type RequestResult = {
  status: number;
  json: unknown;
  headersSeen: Record<string, string>;
};

function tenantOrThrow(tenantId: string): string {
  const tid = String(tenantId || "").trim();
  if (!tid) {
    throw new ReceiverClientError("TENANT_UNAUTHORIZED", "Tenant mancante");
  }
  return tid;
}

function idOrThrow(id: string, label: string): string {
  const v = String(id || "").trim();
  if (!v) {
    throw new ReceiverClientError("INVALID_RESPONSE", `${label} mancante`);
  }
  return v;
}

function joinUrl(baseUrl: string, path: string): { url: string; pathWithQuery: string } {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return { url: `${base}${p}`, pathWithQuery: p };
}

function mapHttpError(status: number): ReceiverClientError {
  if (status === 401 || status === 403) {
    return new ReceiverClientError(
      status === 403 ? "TENANT_UNAUTHORIZED" : "AUTH_FAILED",
      "Autenticazione/autorizzazione Receiver fallita",
      status
    );
  }
  if (status === 404) {
    return new ReceiverClientError(
      "CANDIDATE_NOT_FOUND",
      "Risorsa non trovata sul ricevitore",
      status
    );
  }
  if (status >= 500) {
    return new ReceiverClientError("OFFLINE", "Ricevitore non disponibile", status);
  }
  return new ReceiverClientError("HTTP_ERROR", "Errore HTTP dal ricevitore", status);
}

/**
 * Contratto HTTP previsto (Receiver aziendale):
 *
 * GET  /v1/tenants/{tenantId}/applications?indeedJobId={jobId}
 * GET  /v1/tenants/{tenantId}/applications/{receiverCandidateId}
 * GET  /v1/tenants/{tenantId}/sync-status
 * POST /v1/tenants/{tenantId}/applications/{receiverCandidateId}/cv-open
 *      → { openUrl, expiresAt? }
 *
 * Header: X-Credixa-Tenant-Id + auth (X-Receiver-Key | Authorization Bearer | HMAC).
 * redirect: manual — non si seguono redirect verso host esterni.
 */
async function receiverRequest(
  tenantId: string,
  path: string,
  opts: {
    method?: "GET" | "POST";
    body?: unknown;
    deps: Required<
      Pick<ReceiverClientDeps, "getConfig" | "auth" | "fetch" | "timeoutMs">
    > & { production?: boolean };
  }
): Promise<RequestResult> {
  const tid = tenantOrThrow(tenantId);
  const config = await opts.deps.getConfig(tid);
  if (!config) {
    throw new ReceiverClientError("NOT_CONFIGURED", "Ricevitore non configurato");
  }

  const baseUrl = assertReceiverRequestBaseUrl(config.baseUrl, {
    production: opts.deps.production,
  });
  const method = opts.method || "GET";
  const bodyStr =
    opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const { url, pathWithQuery } = joinUrl(baseUrl, path);

  const authHeaders = await opts.deps.auth.buildHeaders({
    tenantId: tid,
    method,
    path: pathWithQuery,
    body: bodyStr,
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders,
  };
  if (bodyStr !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const signal = AbortSignal.timeout(opts.deps.timeoutMs);
  let res: Response;
  try {
    res = await opts.deps.fetch(url, {
      method,
      headers,
      body: bodyStr,
      cache: "no-store",
      redirect: "manual",
      signal,
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new ReceiverClientError("TIMEOUT", "Timeout verso il ricevitore");
    }
    throw new ReceiverClientError("OFFLINE", "Ricevitore non raggiungibile");
  }

  // Redirect non seguiti verso host esterni
  if (res.status >= 300 && res.status < 400) {
    await res.body?.cancel().catch(() => undefined);
    throw new ReceiverClientError(
      "INVALID_RESPONSE",
      "Redirect dal ricevitore non consentito",
      res.status
    );
  }

  const headersSeen: Record<string, string> = {};
  for (const [k, v] of Object.entries(authHeaders)) {
    headersSeen[k] = k.toLowerCase().includes("key") ||
      k.toLowerCase() === "authorization" ||
      k.toLowerCase().includes("signature")
      ? "[redacted]"
      : v;
  }

  if (!res.ok) {
    await res.text().catch(() => "");
    // Non loggare body (può contenere PII)
    if (res.status === 404) {
      throw new ReceiverClientError(
        path.includes("/cv-open") ? "CV_UNAVAILABLE" : "CANDIDATE_NOT_FOUND",
        path.includes("/cv-open")
          ? "CV non disponibile sul ricevitore"
          : "Candidatura non trovata sul ricevitore",
        404
      );
    }
    throw mapHttpError(res.status);
  }

  if (res.status === 204) {
    return { status: 204, json: null, headersSeen };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ReceiverClientError("INVALID_RESPONSE", "JSON Receiver non valido");
  }

  return { status: res.status, json, headersSeen };
}

function resolveDeps(deps?: ReceiverClientDeps) {
  return {
    getConfig: deps?.getConfig ?? getReceiverConfig,
    auth: deps?.auth ?? defaultReceiverAuthProvider,
    fetch: deps?.fetch ?? fetch,
    timeoutMs: deps?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    production: deps?.production,
  };
}

/** Elenco candidature Receiver per un Indeed jobId (tenant-scoped). */
export async function listApplications(
  tenantId: string,
  indeedJobId: string,
  deps?: ReceiverClientDeps
): Promise<ReceiverCandidate[]> {
  const tid = tenantOrThrow(tenantId);
  const jobId = idOrThrow(indeedJobId, "indeedJobId");
  const path = `/v1/tenants/${encodeURIComponent(tid)}/applications?indeedJobId=${encodeURIComponent(jobId)}`;
  const result = await receiverRequest(tid, path, {
    method: "GET",
    deps: resolveDeps(deps),
  });
  const list = Array.isArray(result.json)
    ? result.json
    : Array.isArray((result.json as { items?: unknown })?.items)
      ? ((result.json as { items: unknown[] }).items)
      : null;
  if (!list) {
    throw new ReceiverClientError("INVALID_RESPONSE", "Elenco candidature non valido");
  }
  return list.map((item) => normalizeReceiverCandidate(item));
}

/** Dettaglio candidatura sul Receiver. */
export async function getApplication(
  tenantId: string,
  receiverCandidateId: string,
  deps?: ReceiverClientDeps
): Promise<ReceiverCandidate> {
  const tid = tenantOrThrow(tenantId);
  const cid = idOrThrow(receiverCandidateId, "receiverCandidateId");
  const path = `/v1/tenants/${encodeURIComponent(tid)}/applications/${encodeURIComponent(cid)}`;
  const result = await receiverRequest(tid, path, {
    method: "GET",
    deps: resolveDeps(deps),
  });
  return normalizeReceiverCandidate(result.json);
}

/** Stato sincronizzazione Receiver per il tenant. */
export async function getSyncStatus(
  tenantId: string,
  deps?: ReceiverClientDeps
): Promise<ReceiverSyncStatus> {
  const tid = tenantOrThrow(tenantId);
  const path = `/v1/tenants/${encodeURIComponent(tid)}/sync-status`;
  const result = await receiverRequest(tid, path, {
    method: "GET",
    deps: resolveDeps(deps),
  });
  if (!result.json || typeof result.json !== "object") {
    throw new ReceiverClientError("INVALID_RESPONSE", "Sync status non valido");
  }
  const obj = result.json as Record<string, unknown>;
  return {
    ok: Boolean(obj.ok ?? obj.healthy ?? true),
    lastSyncAt:
      obj.lastSyncAt != null ? String(obj.lastSyncAt) : null,
    pendingCount:
      typeof obj.pendingCount === "number" ? obj.pendingCount : null,
    message: obj.message != null ? String(obj.message) : null,
  };
}

/**
 * Chiede al Receiver un URL temporaneo autorizzato al CV.
 * Non scarica né memorizza il CV / URL in Credixa.
 */
export async function getCvOpenUrl(
  tenantId: string,
  receiverCandidateId: string,
  deps?: ReceiverClientDeps
): Promise<ReceiverCvOpenResult> {
  const tid = tenantOrThrow(tenantId);
  const cid = idOrThrow(receiverCandidateId, "receiverCandidateId");
  const path = `/v1/tenants/${encodeURIComponent(tid)}/applications/${encodeURIComponent(cid)}/cv-open`;
  const result = await receiverRequest(tid, path, {
    method: "POST",
    body: {},
    deps: resolveDeps(deps),
  });
  if (!result.json || typeof result.json !== "object") {
    throw new ReceiverClientError("CV_UNAVAILABLE", "Risposta CV non valida");
  }
  const obj = result.json as Record<string, unknown>;
  const openUrl = String(obj.openUrl ?? obj.url ?? "").trim();
  if (!openUrl) {
    throw new ReceiverClientError("CV_UNAVAILABLE", "URL CV temporaneo assente");
  }
  // Rifiuta risposte che includono blob
  if (
    typeof obj.data === "string" ||
    typeof obj.base64 === "string" ||
    typeof obj.content === "string"
  ) {
    throw new ReceiverClientError(
      "INVALID_RESPONSE",
      "Risposta CV contiene contenuto file non consentito"
    );
  }
  return {
    openUrl,
    expiresAt: obj.expiresAt != null ? String(obj.expiresAt) : null,
    fileName: obj.fileName != null ? String(obj.fileName).trim() || null : null,
    contentType:
      obj.contentType != null ? String(obj.contentType).trim() || null : null,
  };
}
