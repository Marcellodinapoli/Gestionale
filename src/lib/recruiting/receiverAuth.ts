import "server-only";
import { createHmac } from "node:crypto";
import { ReceiverClientError } from "@/lib/recruiting/receiver";

/**
 * Autenticazione Credixa → Receiver aziendale.
 * Secret SOLO da env server-side (mai Firebase, mai frontend, mai DB config).
 *
 * Env:
 *   RECEIVER_SECRETS_JSON  {"<tenantId>|slug":"<secret>", ...}
 *   RECEIVER_AUTH_MODE     api_key | bearer | hmac  (default: api_key)
 *
 * Pattern allineato a CONNECTOR_KEYS_JSON.
 */

export type ReceiverAuthMode = "api_key" | "bearer" | "hmac";

export type ReceiverAuthRequest = {
  tenantId: string;
  /** Opzionale: slug tenant per lookup env. */
  tenantSlug?: string | null;
  method: string;
  path: string;
  body?: string;
};

/** Header da allegare alla richiesta — il client non vede il secret grezzo. */
export type ReceiverAuthHeaders = Record<string, string>;

export type ReceiverAuthProvider = {
  buildHeaders(req: ReceiverAuthRequest): Promise<ReceiverAuthHeaders>;
};

type ReceiverAuthMaterial = {
  secret: string;
  mode: ReceiverAuthMode;
};

function parseAuthMode(raw: string | undefined): ReceiverAuthMode {
  const m = String(raw || "api_key").trim().toLowerCase();
  if (m === "bearer" || m === "hmac" || m === "api_key") return m;
  return "api_key";
}

/**
 * Risolve il secret per tenant da RECEIVER_SECRETS_JSON.
 * Non loggare il valore restituito.
 */
export function resolveReceiverAuthMaterial(
  tenantId: string,
  tenantSlug?: string | null
): ReceiverAuthMaterial | null {
  const tid = String(tenantId || "").trim();
  if (!tid) return null;
  const keysRaw = (process.env.RECEIVER_SECRETS_JSON || "").trim();
  if (!keysRaw) return null;
  try {
    const map = JSON.parse(keysRaw) as Record<string, string>;
    const slug = String(tenantSlug || "").trim();
    const secret = (map[tid] || (slug ? map[slug] : "") || "").trim();
    if (!secret) return null;
    return {
      secret,
      mode: parseAuthMode(process.env.RECEIVER_AUTH_MODE),
    };
  } catch {
    return null;
  }
}

function hmacSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string
): string {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Costruisce gli header di autenticazione senza esporre il secret al caller
 * oltre agli header destinati alla wire (key/bearer/signature).
 */
export async function buildReceiverAuthHeaders(
  req: ReceiverAuthRequest
): Promise<ReceiverAuthHeaders> {
  const tid = String(req.tenantId || "").trim();
  if (!tid) {
    throw new ReceiverClientError("TENANT_UNAUTHORIZED", "Tenant mancante");
  }
  const material = resolveReceiverAuthMaterial(tid, req.tenantSlug);
  if (!material) {
    throw new ReceiverClientError(
      "AUTH_FAILED",
      "Secret Receiver non configurato per il tenant"
    );
  }

  const headers: ReceiverAuthHeaders = {
    "X-Credixa-Tenant-Id": tid,
  };

  switch (material.mode) {
    case "bearer":
      headers.Authorization = `Bearer ${material.secret}`;
      break;
    case "hmac": {
      const ts = String(Math.floor(Date.now() / 1000));
      const path = req.path.startsWith("/") ? req.path : `/${req.path}`;
      headers["X-Receiver-Timestamp"] = ts;
      headers["X-Receiver-Signature"] = hmacSignature(
        material.secret,
        req.method || "GET",
        path,
        ts,
        req.body || ""
      );
      break;
    }
    case "api_key":
    default:
      headers["X-Receiver-Key"] = material.secret;
      break;
  }

  return headers;
}

/** Provider default usato dal receiverClient. */
export const defaultReceiverAuthProvider: ReceiverAuthProvider = {
  buildHeaders: buildReceiverAuthHeaders,
};
