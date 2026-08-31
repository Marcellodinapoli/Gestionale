import { getFirebaseFirestore } from "@/lib/firebase/admin";
import { OPS_MODEL_COLLECTION } from "@/lib/firebase/opsCollections";

export type TenantCollectionStats = {
  tenantId: string;
  tenantSlug: string;
  collections: Record<string, number>;
  totalDocuments: number;
  source: "live" | "extrapolated";
};

export async function listTenantIds(): Promise<string[]> {
  const db = getFirebaseFirestore();
  const snap = await db.collection("credixa").listDocuments();
  return snap.map((d) => d.id);
}

export async function findTenantIdBySlug(slug: string): Promise<string | null> {
  const db = getFirebaseFirestore();
  const ids = await listTenantIds();
  for (const tid of ids) {
    const doc = await db.doc(`credixa/${tid}/_meta/tenant`).get();
    if (doc.exists && doc.data()?.slug === slug) return tid;
  }
  return ids[0] ?? null;
}

export async function countCollection(tenantId: string, collection: string): Promise<number> {
  const db = getFirebaseFirestore();
  const col = db.collection(`credixa/${tenantId}/${collection}`);
  const agg = await col.count().get();
  return agg.data().count;
}

export async function loadTenantStats(tenantSlug = "demo"): Promise<TenantCollectionStats> {
  const tenantId = await findTenantIdBySlug(tenantSlug);
  if (!tenantId) throw new Error(`Nessun tenant trovato (slug=${tenantSlug})`);

  const collections: Record<string, number> = {};
  let totalDocuments = 0;
  for (const [model, colName] of Object.entries(OPS_MODEL_COLLECTION)) {
    if (colName === "_meta") continue;
    try {
      const n = await countCollection(tenantId, colName);
      collections[model] = n;
      totalDocuments += n;
    } catch {
      collections[model] = 0;
    }
  }

  return { tenantId, tenantSlug, collections, totalDocuments, source: "live" };
}

/** Profili di riferimento quando Firestore non è raggiungibile o tenant vuoto. */
export const EXTRAPOLATION_PROFILES = {
  empty: {
    label: "Tenant vuoto (demo minimal)",
    collections: { Pratica: 0, Incasso: 0, User: 1, Mandante: 0, Attivita: 0, AuditLog: 0 },
  },
  small: {
    label: "Piccolo (500 pratiche)",
    collections: {
      Pratica: 500,
      Incasso: 800,
      User: 25,
      Mandante: 5,
      Attivita: 2000,
      AuditLog: 5000,
      Debitore: 400,
      PianoRata: 1500,
    },
  },
  medium: {
    label: "Medio (5.000 pratiche)",
    collections: {
      Pratica: 5000,
      Incasso: 12000,
      User: 80,
      Mandante: 12,
      Attivita: 40000,
      AuditLog: 80000,
      Debitore: 4500,
      PianoRata: 15000,
    },
  },
  large: {
    label: "Grande (25.000 pratiche)",
    collections: {
      Pratica: 25000,
      Incasso: 60000,
      User: 200,
      Mandante: 20,
      Attivita: 200000,
      AuditLog: 400000,
      Debitore: 22000,
      PianoRata: 75000,
    },
  },
} as const;

export function extrapolatedStats(
  profile: keyof typeof EXTRAPOLATION_PROFILES,
  tenantSlug = "demo"
): TenantCollectionStats {
  const p = EXTRAPOLATION_PROFILES[profile];
  const collections: Record<string, number> = {};
  for (const [model, col] of Object.entries(OPS_MODEL_COLLECTION)) {
    if (col === "_meta") continue;
    collections[model] = (p.collections as Record<string, number>)[model] ?? 0;
  }
  const totalDocuments = Object.values(collections).reduce((s, n) => s + n, 0);
  return {
    tenantId: "extrapolated",
    tenantSlug,
    collections,
    totalDocuments,
    source: "extrapolated",
  };
}

export function sizesMapFromStats(stats: TenantCollectionStats): Map<string, number> {
  return new Map(Object.entries(stats.collections));
}
