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

/** Una sola fetch per pratica: Contabile + Registro condividono il payload. */
export function fetchPraticaExtra(
  praticaId: string
): Promise<PraticaExtraPayload | null> {
  const hit = cache.get(praticaId);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Promise.resolve(hit.data);
  }
  const pending = inflight.get(praticaId);
  if (pending) return pending;

  const req = fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/extra`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: PraticaExtraPayload | null) => {
      if (data) cache.set(praticaId, { at: Date.now(), data });
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(praticaId);
    });

  inflight.set(praticaId, req);
  return req;
}
