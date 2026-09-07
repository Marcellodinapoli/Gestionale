import "server-only";
import { getConnectorApiKey, getConnectorBaseUrl } from "@/lib/data/config";
import { findTenantById } from "@/lib/data/operationalAccess";
import { getTenantConnectorConfig } from "./store";

export type ResolvedConnector = {
  baseUrl: string;
  apiKey: string | undefined;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

/**
 * Risolve il Connettore aziendale dal tenantId.
 * Connection NON cambia se cambia l'URL: si aggiorna solo questa config.
 */
export async function resolveConnectorForTenant(
  tenantId: string
): Promise<ResolvedConnector> {
  const tenant = await findTenantById(tenantId);
  if (!tenant || !tenant.active) {
    throw Object.assign(new Error("Azienda non trovata o non attiva"), {
      status: 404,
    });
  }

  const perTenant = await getTenantConnectorConfig(tenantId);
  const fromEnvMap = resolveFromEnvMap(tenantId, tenant.slug);

  const baseUrl = (
    perTenant?.connectorBaseUrl ||
    fromEnvMap?.baseUrl ||
    getConnectorBaseUrl()
  ).replace(/\/$/, "");

  const apiKey =
    perTenant?.connectorApiKey?.trim() ||
    fromEnvMap?.apiKey ||
    getConnectorApiKey();

  return {
    baseUrl,
    apiKey: apiKey || undefined,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.nome,
  };
}

/**
 * CONNECTOR_URLS_JSON esempio:
 * {"demo":"http://localhost:8443","<tenantUuid>":"https://connettore.cliente.it"}
 * CONNECTOR_KEYS_JSON (opzionale): {"demo":"secret"}
 */
function resolveFromEnvMap(
  tenantId: string,
  tenantSlug: string
): { baseUrl: string; apiKey?: string } | null {
  const urlsRaw = (process.env.CONNECTOR_URLS_JSON || "").trim();
  if (!urlsRaw) return null;
  try {
    const map = JSON.parse(urlsRaw) as Record<string, string>;
    const baseUrl = map[tenantId] || map[tenantSlug];
    if (!baseUrl) return null;
    let apiKey: string | undefined;
    const keysRaw = (process.env.CONNECTOR_KEYS_JSON || "").trim();
    if (keysRaw) {
      const keys = JSON.parse(keysRaw) as Record<string, string>;
      apiKey = keys[tenantId] || keys[tenantSlug] || undefined;
    }
    return { baseUrl, apiKey };
  } catch {
    return null;
  }
}

export async function connectorFetchTenant<T>(
  tenantId: string,
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const resolved = await resolveConnectorForTenant(tenantId);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (resolved.apiKey) headers["X-Connector-Key"] = resolved.apiKey;

  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const url = `${resolved.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Connettore ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw Object.assign(new Error(message), { status: res.status >= 400 ? res.status : 502 });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function creditCalcConnectorPath(
  tenantSlug: string,
  suffix: string
): string {
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `/api/v1/tenants/${encodeURIComponent(tenantSlug)}/creditcalc${path}`;
}
