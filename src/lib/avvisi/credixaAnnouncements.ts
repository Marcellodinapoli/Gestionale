import "server-only";
import { getFirebaseFirestore, firebaseFieldValue } from "@/lib/firebase/admin";

export const CREDIXA_ANNOUNCEMENTS_COLLECTION = "credixa_announcements";
export const CREDIXA_ANNOUNCEMENT_READS_COLLECTION = "credixa_announcement_reads";

export type CredixaAnnouncementType = "avviso" | "aggiornamento" | "alert";
export type CredixaAnnouncementTarget = "all" | "tenant";

export type CredixaAnnouncement = {
  id: string;
  title: string;
  message: string;
  type: CredixaAnnouncementType;
  target: CredixaAnnouncementTarget;
  tenantId: string | null;
  tenantName: string | null;
  active: boolean;
  createdAt: string | null;
  createdBy: string | null;
};

function tsIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null && "toDate" in v) {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof v === "string") return v;
  return null;
}

function mapAnnouncement(
  id: string,
  data: Record<string, unknown>
): CredixaAnnouncement {
  const typeRaw = String(data.type || "avviso").toLowerCase();
  const type: CredixaAnnouncementType =
    typeRaw === "alert" || typeRaw === "aggiornamento" ? typeRaw : "avviso";
  const targetRaw = String(data.target || "all").toLowerCase();
  const target: CredixaAnnouncementTarget =
    targetRaw === "tenant" ? "tenant" : "all";
  return {
    id,
    title: String(data.title || ""),
    message: String(data.message || ""),
    type,
    target,
    tenantId: data.tenantId ? String(data.tenantId) : null,
    tenantName: data.tenantName ? String(data.tenantName) : null,
    active: data.active !== false,
    createdAt: tsIso(data.createdAt),
    createdBy: data.createdBy ? String(data.createdBy) : null,
  };
}

/** Avvisi attivi per un tenant gestionale (all + specifico). */
export async function listAnnouncementsForTenant(
  tenantId: string
): Promise<CredixaAnnouncement[]> {
  const db = getFirebaseFirestore();
  const snap = await db
    .collection(CREDIXA_ANNOUNCEMENTS_COLLECTION)
    .where("active", "==", true)
    .limit(100)
    .get();

  const items = snap.docs
    .map((d) => mapAnnouncement(d.id, d.data() as Record<string, unknown>))
    .filter(
      (a) =>
        a.target === "all" ||
        (a.target === "tenant" && a.tenantId === tenantId)
    );

  items.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
  return items;
}

export async function listReadAnnouncementIds(
  tenantId: string,
  userId: string
): Promise<Set<string>> {
  const db = getFirebaseFirestore();
  const snap = await db
    .collection(CREDIXA_ANNOUNCEMENT_READS_COLLECTION)
    .where("tenantId", "==", tenantId)
    .where("userId", "==", userId)
    .limit(200)
    .get();
  return new Set(
    snap.docs.map((d) => String((d.data() as { announcementId?: string }).announcementId || ""))
  );
}

/** Numero avvisi attivi non ancora segnati come letti dall’utente. */
export async function countUnreadAnnouncementsForUser(
  tenantId: string,
  userId: string
): Promise<number> {
  const [items, readIds] = await Promise.all([
    listAnnouncementsForTenant(tenantId),
    listReadAnnouncementIds(tenantId, userId),
  ]);
  return items.reduce((n, a) => n + (readIds.has(a.id) ? 0 : 1), 0);
}

export async function markAnnouncementRead(input: {
  announcementId: string;
  tenantId: string;
  userId: string;
}): Promise<void> {
  const db = getFirebaseFirestore();
  const FieldValue = firebaseFieldValue();
  const id = `${input.announcementId}_${input.userId}`;
  await db.collection(CREDIXA_ANNOUNCEMENT_READS_COLLECTION).doc(id).set(
    {
      announcementId: input.announcementId,
      tenantId: input.tenantId,
      userId: input.userId,
      seenAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/** Segna più avvisi come letti (apertura pagina Avvisi). */
export async function markAnnouncementsReadMany(input: {
  announcementIds: string[];
  tenantId: string;
  userId: string;
}): Promise<void> {
  const ids = [...new Set(input.announcementIds.map((x) => x.trim()).filter(Boolean))];
  if (!ids.length) return;
  const db = getFirebaseFirestore();
  const FieldValue = firebaseFieldValue();
  const batch = db.batch();
  for (const announcementId of ids) {
    const docId = `${announcementId}_${input.userId}`;
    batch.set(
      db.collection(CREDIXA_ANNOUNCEMENT_READS_COLLECTION).doc(docId),
      {
        announcementId,
        tenantId: input.tenantId,
        userId: input.userId,
        seenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}
