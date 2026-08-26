/**
 * Piano dati operativo Credixa.
 *
 * Regola: le pagine leggono sempre dal **data plane Firebase** (cache operativa).
 * Un eventuale DB del cliente NON viene interrogato a ogni apertura pagina:
 * un connettore sincronizza in background (incrementale) verso Firebase.
 *
 * Netlify = frontend; Firebase = backend operativo e cache di sync.
 */

export type OperationalBackend = "firebase" | "company";
export type FormazioneBackend = "firebase";

export function getOperationalBackend(): OperationalBackend {
  const raw = (process.env.OPERATIONAL_BACKEND || "firebase").trim().toLowerCase();
  if (raw === "company") return "company";
  return "firebase";
}

export function getFormazioneBackend(): FormazioneBackend {
  return "firebase";
}

export function assertOperationalBackendReady() {
  if (getOperationalBackend() === "company") {
    throw new Error(
      "Connettore database aziendale non ancora implementato. Usa Firebase (OPERATIONAL_BACKEND=firebase)."
    );
  }
}

/**
 * Sorgente di verità per le pagine UI.
 * Anche con connettore company attivo, le letture runtime restano su Firebase
 * (alimentato dalla sync incrementale).
 */
export type RuntimeDataPlane = "firebase";

export function getRuntimeDataPlane(): RuntimeDataPlane {
  return "firebase";
}

export type SyncCursor = {
  tenantId: string;
  collection: string;
  /** ISO timestamp ultima sync riuscita (updatedAt / mirroredAt). */
  since: string | null;
};

export type SyncBatchResult = {
  upserted: number;
  deleted: number;
  cursor: string | null;
  done: boolean;
};

/**
 * Contratto connettore → Firebase (futuro server cliente).
 * Implementazioni: no-op oggi; company connector in seguito.
 */
export interface OperationalConnector {
  readonly id: string;
  pullIncremental(cursor: SyncCursor): Promise<SyncBatchResult>;
  pushLocalChange?(args: {
    tenantId: string;
    collection: string;
    id: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export function describeDataArchitecture() {
  return {
    frontend: "netlify",
    runtimeReads: getRuntimeDataPlane(),
    operationalBackend: getOperationalBackend(),
    pageLoadsHitCustomerDb: false,
    syncMode: "incremental-to-firebase",
  } as const;
}
