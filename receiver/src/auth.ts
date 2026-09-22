import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ReceiverAuthMode = "api_key" | "bearer" | "hmac";

export type AuthConfig = {
  mode: ReceiverAuthMode;
  /** tenantId → secret */
  secrets: Map<string, string>;
};

export function parseAuthMode(raw: string | undefined): ReceiverAuthMode {
  const m = String(raw || "api_key").trim().toLowerCase();
  if (m === "bearer" || m === "hmac" || m === "api_key") return m;
  return "api_key";
}

export function loadSecretsFromJson(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  const text = String(raw || "").trim();
  if (!text) return map;
  try {
    const obj = JSON.parse(text) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) {
      const key = String(k || "").trim();
      const secret = String(v || "").trim();
      if (key && secret) map.set(key, secret);
    }
  } catch {
    // invalid JSON → empty (auth will fail closed)
  }
  return map;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
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

export type AuthResult =
  | { ok: true; tenantId: string }
  | { ok: false; status: 401 | 403; code: "AUTH_FAILED" | "TENANT_UNAUTHORIZED" };

/**
 * Autentica richiesta Credixa → Receiver.
 * Il tenant autenticato DEVE coincidere con `pathTenantId`.
 */
export function authenticateCredixaRequest(opts: {
  config: AuthConfig;
  pathTenantId: string;
  headerTenantId: string | undefined;
  method: string;
  /** path + query come usato da Credixa per HMAC */
  pathWithQuery: string;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}): AuthResult {
  const pathTenant = String(opts.pathTenantId || "").trim();
  if (!pathTenant) {
    return { ok: false, status: 403, code: "TENANT_UNAUTHORIZED" };
  }

  const headerTenant = String(opts.headerTenantId || "").trim();
  if (!headerTenant) {
    return { ok: false, status: 401, code: "AUTH_FAILED" };
  }
  if (headerTenant !== pathTenant) {
    return { ok: false, status: 403, code: "TENANT_UNAUTHORIZED" };
  }

  const secret = opts.config.secrets.get(pathTenant);
  if (!secret) {
    return { ok: false, status: 403, code: "TENANT_UNAUTHORIZED" };
  }

  const h = opts.headers;
  const get = (name: string) => {
    const v = h[name] ?? h[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };

  switch (opts.config.mode) {
    case "bearer": {
      const auth = String(get("authorization") || "");
      const m = /^Bearer\s+(.+)$/i.exec(auth);
      if (!m || !safeEqual(m[1]!.trim(), secret)) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      break;
    }
    case "hmac": {
      const ts = String(get("x-receiver-timestamp") || "").trim();
      const sig = String(get("x-receiver-signature") || "").trim();
      if (!ts || !sig) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      const expected = hmacSignature(
        secret,
        opts.method,
        opts.pathWithQuery.startsWith("/")
          ? opts.pathWithQuery
          : `/${opts.pathWithQuery}`,
        ts,
        opts.body || ""
      );
      if (!safeEqual(sig.toLowerCase(), expected.toLowerCase())) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      break;
    }
    case "api_key":
    default: {
      const key = String(get("x-receiver-key") || "").trim();
      if (!key || !safeEqual(key, secret)) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      break;
    }
  }

  return { ok: true, tenantId: pathTenant };
}

/**
 * Autenticazione SOURCE (Indeed / CreditCore) — secret separati da Credixa.
 * Header tenant: X-Source-Tenant-Id
 * api_key: X-Receiver-Source-Key
 * bearer: Authorization Bearer
 * hmac: X-Receiver-Source-Timestamp + X-Receiver-Source-Signature
 */
export function authenticateSourceRequest(opts: {
  config: AuthConfig;
  pathTenantId: string;
  headerTenantId: string | undefined;
  method: string;
  pathWithQuery: string;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}): AuthResult {
  const pathTenant = String(opts.pathTenantId || "").trim();
  if (!pathTenant) {
    return { ok: false, status: 403, code: "TENANT_UNAUTHORIZED" };
  }

  const headerTenant = String(opts.headerTenantId || "").trim();
  if (!headerTenant) {
    return { ok: false, status: 401, code: "AUTH_FAILED" };
  }
  if (headerTenant !== pathTenant) {
    return { ok: false, status: 403, code: "TENANT_UNAUTHORIZED" };
  }

  const secret = opts.config.secrets.get(pathTenant);
  if (!secret) {
    return { ok: false, status: 403, code: "TENANT_UNAUTHORIZED" };
  }

  const h = opts.headers;
  const get = (name: string) => {
    const v = h[name] ?? h[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };

  switch (opts.config.mode) {
    case "bearer": {
      const auth = String(get("authorization") || "");
      const m = /^Bearer\s+(.+)$/i.exec(auth);
      if (!m || !safeEqual(m[1]!.trim(), secret)) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      break;
    }
    case "hmac": {
      const ts = String(get("x-receiver-source-timestamp") || "").trim();
      const sig = String(get("x-receiver-source-signature") || "").trim();
      if (!ts || !sig) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      const expected = hmacSignature(
        secret,
        opts.method,
        opts.pathWithQuery.startsWith("/")
          ? opts.pathWithQuery
          : `/${opts.pathWithQuery}`,
        ts,
        opts.body || ""
      );
      if (!safeEqual(sig.toLowerCase(), expected.toLowerCase())) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      break;
    }
    case "api_key":
    default: {
      const key = String(get("x-receiver-source-key") || "").trim();
      if (!key || !safeEqual(key, secret)) {
        return { ok: false, status: 401, code: "AUTH_FAILED" };
      }
      break;
    }
  }

  return { ok: true, tenantId: pathTenant };
}

export function newId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = randomBytes(8).toString("hex");
  return `${prefix}-${ts}-${rnd}`;
}
