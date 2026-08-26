/**
 * Cache per-richiesta (RSC / Route Handler / Server Action).
 * Evita download ripetuti della stessa collection e getById duplicati.
 */
import { cache } from "react";

export type RequestCacheStore = {
  collections: Map<string, Promise<unknown[]>>;
  docs: Map<string, Promise<unknown | null>>;
  tenantIds: Promise<string[]> | null;
  /** Indice id → doc per model:tenant (dopo loadCollection). */
  indexes: Map<string, Map<string, unknown>>;
};

export const getFirebaseRequestCache = cache((): RequestCacheStore => ({
  collections: new Map(),
  docs: new Map(),
  tenantIds: null,
  indexes: new Map(),
}));

export function collectionCacheKey(model: string, tenantId?: string | null) {
  return `${model}::${tenantId || "*"}`;
}

export function docCacheKey(model: string, id: string) {
  return `${model}#${id}`;
}

/** Invalida cache dopo scritture (stessa richiesta). */
export function invalidateModelCache(model: string, tenantId?: string | null) {
  const store = getFirebaseRequestCache();
  const prefix = `${model}::`;
  for (const key of store.collections.keys()) {
    if (key.startsWith(prefix)) store.collections.delete(key);
  }
  if (tenantId) {
    store.collections.delete(collectionCacheKey(model, tenantId));
    store.indexes.delete(collectionCacheKey(model, tenantId));
  }
  store.indexes.delete(collectionCacheKey(model, null));
  for (const key of [...store.docs.keys()]) {
    if (key.startsWith(`${model}#`)) store.docs.delete(key);
  }
}
