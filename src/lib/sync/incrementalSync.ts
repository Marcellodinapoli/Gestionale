/**
 * Sync incrementale verso il data plane Firebase.
 * Le pagine leggono solo Firebase; il connettore cliente scrive qui in background.
 */
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import type { OperationalConnector, SyncBatchResult, SyncCursor } from "@/lib/dataAccess";
import { collectionForOpsModel } from "@/lib/firebase/opsCollections";

const CURSOR_COL = "_syncCursors";

export async function readSyncCursor(
  tenantId: string,
  collection: string
): Promise<string | null> {
  const db = getFirebaseFirestore();
  const snap = await db.doc(`credixa/${tenantId}/${CURSOR_COL}/${collection}`).get();
  if (!snap.exists) return null;
  const since = snap.data()?.since;
  return typeof since === "string" ? since : null;
}

export async function writeSyncCursor(
  tenantId: string,
  collection: string,
  since: string
) {
  const db = getFirebaseFirestore();
  await db.doc(`credixa/${tenantId}/${CURSOR_COL}/${collection}`).set(
    { since, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

/**
 * Applica un batch upsert/delete su Firestore (usato dal connettore).
 * `updatedAt` consente sync incrementali successive.
 */
export async function applyIncrementalUpserts(args: {
  tenantId: string;
  model: string;
  upserts: Array<{ id: string; data: Record<string, unknown> }>;
  deletes?: string[];
}): Promise<SyncBatchResult> {
  const col = collectionForOpsModel(args.model);
  if (!col) {
    return { upserted: 0, deleted: 0, cursor: null, done: true };
  }
  const db = getFirebaseFirestore();
  const now = new Date().toISOString();
  let upserted = 0;
  let deleted = 0;

  // Batch Firestore max 500
  const chunks = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const chunk of chunks(args.upserts, 400)) {
    const batch = db.batch();
    for (const row of chunk) {
      const ref = db.doc(`credixa/${args.tenantId}/${col}/${row.id}`);
      batch.set(
        ref,
        {
          ...row.data,
          id: row.id,
          tenantId: args.tenantId,
          updatedAt: (row.data.updatedAt as string) || now,
          _syncedAt: now,
        },
        { merge: true }
      );
      upserted++;
    }
    await batch.commit();
  }

  for (const chunk of chunks(args.deletes || [], 400)) {
    const batch = db.batch();
    for (const id of chunk) {
      batch.delete(db.doc(`credixa/${args.tenantId}/${col}/${id}`));
      deleted++;
    }
    await batch.commit();
  }

  await writeSyncCursor(args.tenantId, col, now);
  return { upserted, deleted, cursor: now, done: true };
}

/** Connettore stub: nessuna sorgente esterna; Firebase è già la fonte. */
export const firebasePassthroughConnector: OperationalConnector = {
  id: "firebase-passthrough",
  async pullIncremental(_cursor: SyncCursor): Promise<SyncBatchResult> {
    return { upserted: 0, deleted: 0, cursor: _cursor.since, done: true };
  },
};

/**
 * Placeholder connettore aziendale: in futuro pullIncremental leggerà
 * solo record con updatedAt > since dal DB cliente e li scriverà su Firebase.
 */
export const companyConnectorStub: OperationalConnector = {
  id: "company-stub",
  async pullIncremental(cursor: SyncCursor): Promise<SyncBatchResult> {
    void cursor;
    throw new Error(
      "Connettore company non configurato: le pagine restano su Firebase. Implementa pullIncremental verso applyIncrementalUpserts."
    );
  },
};

export function getActiveConnector(): OperationalConnector {
  const mode = (process.env.OPERATIONAL_BACKEND || "firebase").trim().toLowerCase();
  if (mode === "company") return companyConnectorStub;
  return firebasePassthroughConnector;
}

/**
 * Documenti modificati dopo `since` (lettura incrementale lato Firebase).
 * Utile per client che fanno soft-refresh senza scaricare tutta la collection.
 */
export async function listUpdatedSince(args: {
  tenantId: string;
  model: string;
  since: string;
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  const col = collectionForOpsModel(args.model);
  if (!col) return [];
  const db = getFirebaseFirestore();
  const limit = Math.min(args.limit ?? 200, 500);
  try {
    const snap = await db
      .collection(`credixa/${args.tenantId}/${col}`)
      .where("updatedAt", ">", args.since)
      .orderBy("updatedAt", "asc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, tenantId: args.tenantId, ...d.data() }));
  } catch {
    // Indice mancante o campo assente: fallback vuoto (sync non bloccante)
    return [];
  }
}
