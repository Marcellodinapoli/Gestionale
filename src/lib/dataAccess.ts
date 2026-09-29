/**
 * Accesso ai dati operativi Credixa.
 *
 * Con DATABASE_PROVIDER=neon (target cloud / Netlify e locale):
 *   Credixa → Repository → Neon Postgres
 *
 * Con DATABASE_PROVIDER=connector:
 *   Credixa → Repository → ConnectorClient → Connettore → SQL Server
 *
 * Con DATABASE_PROVIDER=firestore (legacy):
 *   Credixa → prisma → firebasePrisma → Firestore
 *
 * Formazione resta sempre su Firebase indipendentemente da questo provider.
 */

import { getDatabaseProvider } from "@/lib/data/config";

export type OperationalBackend = "firestore" | "connector" | "neon";
export type FormazioneBackend = "firebase";

export function getOperationalBackend(): OperationalBackend {
  const provider = getDatabaseProvider();
  if (provider === "connector") return "connector";
  if (provider === "neon") return "neon";
  return "firestore";
}

export function getFormazioneBackend(): FormazioneBackend {
  return "firebase";
}

export function assertOperationalBackendReady() {
  const backend = getOperationalBackend();
  if (backend === "connector") {
    const url = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";
    if (!url) {
      throw new Error("CONNECTOR_BASE_URL non configurato");
    }
  }
  if (backend === "neon") {
    const url = (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_NEON || "").trim();
    if (!url) {
      throw new Error("NEON_DATABASE_URL non configurato");
    }
  }
}

export type RuntimeDataPlane = "connector" | "firestore" | "neon";

export function getRuntimeDataPlane(): RuntimeDataPlane {
  const backend = getOperationalBackend();
  if (backend === "connector") return "connector";
  if (backend === "neon") return "neon";
  return "firestore";
}

export function describeDataArchitecture() {
  const backend = getOperationalBackend();
  return {
    frontend: "nextjs",
    runtimeReads: getRuntimeDataPlane(),
    operationalBackend: backend,
    pageLoadsHitCustomerDb: backend === "connector" || backend === "neon",
    syncMode:
      backend === "connector"
        ? "direct-via-connector"
        : backend === "neon"
          ? "direct-neon"
          : "firestore-legacy",
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
