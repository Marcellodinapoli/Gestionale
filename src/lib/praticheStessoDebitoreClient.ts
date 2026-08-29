"use client";

import { isPraticaChiusa } from "@/lib/praticaCollegata";

export type PraticaCollegataVoceClient = {
  id: string;
  numero: string;
  nome: string;
  cf?: string | null;
  stato: string;
  codiceScarico?: string | null;
  mandante: string;
  mandanteNome: string;
  perimetro?: string | null;
  residuo: number;
  importoDaIncassare?: number;
  rateInsolute?: number | null;
  scadenza: string | null;
  updatedAt?: string;
  accessibile?: boolean;
};

export type PraticheStessoDebitoreClientPayload = {
  corrente: PraticaCollegataVoceClient;
  altre: PraticaCollegataVoceClient[];
  altreChiuse: PraticaCollegataVoceClient[];
};

const TTL_MS = 45_000;
const cache = new Map<
  string,
  { at: number; data: PraticheStessoDebitoreClientPayload }
>();
const inflight = new Map<
  string,
  Promise<PraticheStessoDebitoreClientPayload | null>
>();

/** Adatta il payload cluster alla pratica corrente (cache condivisa tra collegate). */
export function normalizePayloadForPratica(
  payload: PraticheStessoDebitoreClientPayload,
  praticaId: string
): PraticheStessoDebitoreClientPayload {
  if (payload.corrente.id === praticaId) return payload;
  const all = [payload.corrente, ...payload.altre, ...payload.altreChiuse];
  const hit = all.find((v) => v.id === praticaId);
  if (!hit) return payload;
  const others = all.filter((v) => v.id !== praticaId);
  return {
    corrente: hit,
    altre: others.filter((v) => !isPraticaChiusa(v.stato)),
    altreChiuse: others.filter((v) => isPraticaChiusa(v.stato)),
  };
}

function storeCluster(data: PraticheStessoDebitoreClientPayload) {
  const at = Date.now();
  const ids = new Set<string>([
    data.corrente.id,
    ...data.altre.map((v) => v.id),
    ...data.altreChiuse.map((v) => v.id),
  ]);
  for (const id of ids) {
    cache.set(id, { at, data });
  }
}

/** Popola la cache client (es. da payload SSR) senza chiamata API. */
export function seedPraticheStessoDebitore(
  data: PraticheStessoDebitoreClientPayload
) {
  storeCluster(data);
}

/** Lettura immediata dalla cache (senza rete). */
export function peekPraticheStessoDebitore(
  praticaId: string
): PraticheStessoDebitoreClientPayload | null {
  const hit = cache.get(praticaId);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(praticaId);
    return null;
  }
  return normalizePayloadForPratica(hit.data, praticaId);
}

/**
 * Una sola richiesta per cluster CF: dedupe in-flight + cache su tutti gli id
 * (barra F9 e click tra collegate riusano lo stesso payload).
 */
export function fetchPraticheStessoDebitore(
  praticaId: string
): Promise<PraticheStessoDebitoreClientPayload | null> {
  const cached = peekPraticheStessoDebitore(praticaId);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(praticaId);
  if (pending) return pending;

  const req = fetch(
    `/api/pratiche-stesso-debitore?id=${encodeURIComponent(praticaId)}`
  )
    .then((res) => (res.ok ? res.json() : null))
    .then((data: PraticheStessoDebitoreClientPayload | null) => {
      if (data?.corrente) {
        storeCluster(data);
        return normalizePayloadForPratica(data, praticaId);
      }
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(praticaId);
    });

  inflight.set(praticaId, req);
  return req;
}

export function invalidatePraticheStessoDebitore(praticaId?: string) {
  if (!praticaId) {
    cache.clear();
    inflight.clear();
    return;
  }
  const hit = cache.get(praticaId);
  if (hit) {
    const ids = [
      hit.data.corrente.id,
      ...hit.data.altre.map((v) => v.id),
      ...hit.data.altreChiuse.map((v) => v.id),
    ];
    for (const id of ids) cache.delete(id);
  } else {
    cache.delete(praticaId);
  }
  inflight.delete(praticaId);
}
