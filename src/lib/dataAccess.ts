/**
 * Accesso ai dati operativi Credixa.
 *
 * Con DATABASE_PROVIDER=connector:
 *   Credixa → Repository → ConnectorClient → Connettore → SQL Server
 *
 * Con DATABASE_PROVIDER=firestore (default durante migrazione):
 *   Credixa → prisma → firebasePrisma → Firestore
 *
 * Formazione resta sempre su Firebase indipendentemente da questo provider.
 */

import { getDatabaseProvider } from "@/lib/data/config";

export type OperationalBackend = "firestore" | "connector";
export type FormazioneBackend = "firebase";

export function getOperationalBackend(): OperationalBackend {
  const provider = getDatabaseProvider();
  if (provider === "connector") return "connector";
  return "firestore";
}

export function getFormazioneBackend(): FormazioneBackend {
  return "firebase";
}

export function assertOperationalBackendReady() {
  if (getOperationalBackend() === "connector") {
    const url = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";
    if (!url) {
      throw new Error("CONNECTOR_BASE_URL non configurato");
    }
  }
}

export type RuntimeDataPlane = "connector" | "firestore";

export function getRuntimeDataPlane(): RuntimeDataPlane {
  return getOperationalBackend() === "connector" ? "connector" : "firestore";
}

export function describeDataArchitecture() {
  const backend = getOperationalBackend();
  return {
    frontend: "nextjs",
    runtimeReads: getRuntimeDataPlane(),
    operationalBackend: backend,
    pageLoadsHitCustomerDb: backend === "connector",
    syncMode: backend === "connector" ? "direct-via-connector" : "firestore-legacy",
    formazioneBackend: getFormazioneBackend(),
  } as const;
}

/** Tipi legacy per sync incrementale Firebase (non usati con connector diretto). */
export type SyncCursor = { since: string; collection?: string };
export type SyncBatchResult = {
  upserted: number;
  deleted: number;
  cursor?: SyncCursor | string | null;
  done?: boolean;
};
export type OperationalConnector = {
  id: string;
  pullIncremental(cursor: SyncCursor): Promise<SyncBatchResult>;
};
