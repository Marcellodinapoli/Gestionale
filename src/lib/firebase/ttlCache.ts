/**
 * Cache cross-request tenant-safe con TTL breve.
 * Chiave sempre prefissata con tenantId — nessun dato cross-tenant.
 */
type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const DEFAULT_TTL_MS = 15_000;

function key(tenantId: string, model: string, suffix = "") {
  return `t:${tenantId}|m:${model}|${suffix}`;
}

export function ttlGet<T>(tenantId: string, model: string, suffix = ""): T | undefined {
  if (!tenantId) return undefined;
  const k = key(tenantId, model, suffix);
  const e = store.get(k) as Entry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    store.delete(k);
    return undefined;
  }
  return e.value;
}

export function ttlSet<T>(
  tenantId: string,
  model: string,
  value: T,
  ttlMs = DEFAULT_TTL_MS,
  suffix = ""
) {
  if (!tenantId) return;
  store.set(key(tenantId, model, suffix), {
    value,
    expires: Date.now() + ttlMs,
  });
  // Evita crescita illimitata
  if (store.size > 500) {
    const now = Date.now();
    for (const [kk, vv] of store) {
      if (vv.expires < now) store.delete(kk);
    }
  }
}

export function ttlInvalidateTenantModel(tenantId: string, model: string) {
  const prefix = `t:${tenantId}|m:${model}|`;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export function ttlInvalidateTenant(tenantId: string) {
  const prefix = `t:${tenantId}|`;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
