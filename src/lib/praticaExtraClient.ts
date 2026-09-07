"use client";

export type PraticaExtraPayload = {
  attivita: Array<{
    id: string;
    tipo: string;
    esito: string | null;
    nota: string | null;
    scheduledAt: string | null;
    createdAt: string;
    fissata?: boolean;
    importante?: boolean;
    bloccata?: boolean;
    user: { name: string };
  }>;
  incassi: Array<{
    id: string;
    data: string;
    dataScadenza: string | null;
    capitale: number;
    interessi: number;
    spese: number;
    speseRec: number;
    importo: number;
    modo: string | null;
    causale: string | null;
    fattura?: string | null;
    metodo: string;
    user?: { name: string } | null;
  }>;
  fatture: Array<{
    id: string;
    numero: string;
    causale: string | null;
    dataFattura: string;
    dataScadenza: string;
    importo: number;
    pagato: number;
  }>;
};

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; data: PraticaExtraPayload }>();
const inflight = new Map<string, Promise<PraticaExtraPayload | null>>();

export const PRATICA_EXTRA_INVALIDATE_EVENT = "pratica-extra-invalidate";

/** Invalida la cache client del registro note / contabile. */
export function invalidatePraticaExtra(praticaId?: string) {
  if (!praticaId) {
    cache.clear();
  } else {
    cache.delete(praticaId);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PRATICA_EXTRA_INVALIDATE_EVENT, {
        detail: { praticaId: praticaId ?? null },
      })
    );
  }
}

/** Una sola fetch per pratica: Contabile + Registro condividono il payload. */
export function fetchPraticaExtra(
  praticaId: string,
  opts?: { force?: boolean }
): Promise<PraticaExtraPayload | null> {
  if (!opts?.force) {
    const hit = cache.get(praticaId);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return Promise.resolve(hit.data);
    }
  } else {
    cache.delete(praticaId);
  }
  const pendingKey = opts?.force ? `${praticaId}:force` : praticaId;
  const pending = inflight.get(pendingKey);
  if (pending) return pending;

  const bust = opts?.force ? `?_=${Date.now()}` : "";
  const req = fetch(
    `/api/pratiche/${encodeURIComponent(praticaId)}/extra${bust}`,
    {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    }
  )
    .then((res) => (res.ok ? res.json() : null))
    .then((data: PraticaExtraPayload | null) => {
      if (data) cache.set(praticaId, { at: Date.now(), data });
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(pendingKey);
    });

  inflight.set(pendingKey, req);
  return req;
}
