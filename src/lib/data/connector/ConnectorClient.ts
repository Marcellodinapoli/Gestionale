import "server-only";
import { getConnectorApiKey, getConnectorBaseUrl } from "../config";

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

export type ConnectorRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Tenant slug — il Connettore risolve internamente; non fidarsi di tenantId dal browser. */
  tenantSlug?: string;
  signal?: AbortSignal;
};

/**
 * Client HTTP server-side verso il Connettore Credixa.
 * Il browser NON usa mai questa classe.
 */
export async function connectorFetch<T>(
  path: string,
  opts: ConnectorRequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = getConnectorApiKey();
  if (apiKey) headers["X-Connector-Key"] = apiKey;

  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const url = `${getConnectorBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    cache: "no-store",
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ConnectorError(`Connector ${path} → ${res.status}`, res.status, text);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
