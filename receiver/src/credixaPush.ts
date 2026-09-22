import type { ReceiverCandidateDto } from "./models.js";

function sourceKeyForTenant(tenantId: string): string {
  const tid = String(tenantId || "").trim();
  if (!tid) return "";

  const secretsRaw = String(process.env.RECEIVER_SOURCE_SECRETS_JSON || "").trim();
  let map: Record<string, string> = {};
  if (secretsRaw) {
    try {
      map = JSON.parse(secretsRaw) as Record<string, string>;
    } catch {
      map = {};
    }
  }

  const fromMap = String(map[tid] || "").trim();
  if (fromMap) return fromMap;

  // Legacy single-tenant: solo se la mappa è vuota
  if (Object.keys(map).length === 0) {
    return String(process.env.RECEIVER_SOURCE_KEY || "").trim();
  }
  return "";
}

/**
 * Notifica Credixa subito dopo ingest SOURCE (create/update).
 * Best-effort: non fallisce l'ingest se il push non riesce.
 * Multi-azienda: secret sempre risolto per tenantId.
 */
export async function pushApplicationToCredixa(
  tenantId: string,
  dto: ReceiverCandidateDto
): Promise<void> {
  const url = String(process.env.CREDIXA_PUSH_URL || "").trim();
  if (!url) return;

  const sourceKey = sourceKeyForTenant(tenantId);
  if (!sourceKey) {
    console.warn(
      "[receiver] CREDIXA_PUSH_URL impostato ma secret SOURCE assente per tenant",
      tenantId
    );
    return;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Source-Tenant-Id": tenantId,
        "X-Receiver-Source-Key": sourceKey,
      },
      body: JSON.stringify(dto),
      signal: ac.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[receiver] credixa push failed",
        tenantId,
        res.status,
        text.slice(0, 200)
      );
    }
  } catch (e) {
    console.warn(
      "[receiver] credixa push error",
      tenantId,
      e instanceof Error ? e.message : e
    );
  } finally {
    clearTimeout(timer);
  }
}
