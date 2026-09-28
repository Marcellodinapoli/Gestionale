import { getFirebaseFirestore, firebaseFieldValue } from "@/lib/firebase/admin";

export const CREDIXA_SUPPORT_COLLECTION = "credixa_support";

export type SupportTicketStatus = "open" | "closed";

export type SupportTicket = {
  id: string;
  tenantId: string;
  tenantSlug: string | null;
  tenantName: string | null;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SupportMessage = {
  id: string;
  sender: "user" | "admin";
  text: string;
  timestamp: string | null;
};

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function mapTicket(
  id: string,
  data: Record<string, unknown>
): SupportTicket {
  return {
    id,
    tenantId: String(data.tenantId || ""),
    tenantSlug: data.tenantSlug ? String(data.tenantSlug) : null,
    tenantName: data.tenantName ? String(data.tenantName) : null,
    userId: String(data.userId || ""),
    userEmail: String(data.userEmail || ""),
    userName: String(data.userName || ""),
    subject: String(data.subject || ""),
    status: data.status === "closed" ? "closed" : "open",
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export async function listTicketsForTenant(tenantId: string): Promise<SupportTicket[]> {
  const db = getFirebaseFirestore();
  const snap = await db
    .collection(CREDIXA_SUPPORT_COLLECTION)
    .where("tenantId", "==", tenantId)
    .limit(100)
    .get();

  const tickets = snap.docs.map((d) => mapTicket(d.id, d.data() as Record<string, unknown>));
  tickets.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
  return tickets;
}

export async function listMessagesForTicket(ticketId: string): Promise<SupportMessage[]> {
  const db = getFirebaseFirestore();
  const snap = await db
    .collection(CREDIXA_SUPPORT_COLLECTION)
    .doc(ticketId)
    .collection("messages")
    .orderBy("timestamp", "asc")
    .limit(200)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      sender: data.sender === "admin" ? "admin" : "user",
      text: String(data.text || ""),
      timestamp: tsToIso(data.timestamp),
    };
  });
}

export async function createSupportTicket(input: {
  tenantId: string;
  tenantSlug: string | null;
  tenantName: string | null;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
}): Promise<string> {
  const db = getFirebaseFirestore();
  const FieldValue = firebaseFieldValue();
  const ref = db.collection(CREDIXA_SUPPORT_COLLECTION).doc();
  await ref.set({
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    tenantName: input.tenantName,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    subject: input.subject,
    status: "open",
    product: "credixa",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await ref.collection("messages").add({
    sender: "user",
    text: input.message,
    timestamp: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function replyToSupportTicket(input: {
  ticketId: string;
  tenantId: string;
  text: string;
}): Promise<void> {
  const db = getFirebaseFirestore();
  const FieldValue = firebaseFieldValue();
  const ref = db.collection(CREDIXA_SUPPORT_COLLECTION).doc(input.ticketId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Ticket non trovato");
  const data = doc.data() || {};
  if (String(data.tenantId || "") !== input.tenantId) {
    throw new Error("Ticket non appartenente a questa azienda");
  }
  if (data.status === "closed") throw new Error("Ticket chiuso");

  await ref.collection("messages").add({
    sender: "user",
    text: input.text,
    timestamp: FieldValue.serverTimestamp(),
  });
  await ref.update({ updatedAt: FieldValue.serverTimestamp() });
}

export async function getTicketForTenant(
  ticketId: string,
  tenantId: string
): Promise<SupportTicket | null> {
  const db = getFirebaseFirestore();
  const doc = await db.collection(CREDIXA_SUPPORT_COLLECTION).doc(ticketId).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  if (String(data.tenantId || "") !== tenantId) return null;
  return mapTicket(doc.id, data as Record<string, unknown>);
}

async function assertTicketOwned(ticketId: string, tenantId: string) {
  const db = getFirebaseFirestore();
  const ref = db.collection(CREDIXA_SUPPORT_COLLECTION).doc(ticketId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Ticket non trovato");
  const data = doc.data() || {};
  if (String(data.tenantId || "") !== tenantId) {
    throw new Error("Ticket non appartenente a questa azienda");
  }
  return { ref, data };
}

export async function updateSupportTicket(input: {
  ticketId: string;
  tenantId: string;
  subject: string;
  firstMessageText?: string | null;
  firstMessageId?: string | null;
}): Promise<void> {
  const FieldValue = firebaseFieldValue();
  const { ref, data } = await assertTicketOwned(input.ticketId, input.tenantId);
  if (data.status === "closed") throw new Error("Ticket chiuso: non modificabile");

  await ref.update({
    subject: input.subject,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (input.firstMessageId && input.firstMessageText != null) {
    const msgRef = ref.collection("messages").doc(input.firstMessageId);
    const msg = await msgRef.get();
    if (!msg.exists) throw new Error("Messaggio non trovato");
    const msgData = msg.data() || {};
    if (msgData.sender === "admin") {
      throw new Error("Non puoi modificare le risposte dell'assistenza");
    }
    await msgRef.update({ text: input.firstMessageText });
  }
}

export async function deleteSupportTicket(input: {
  ticketId: string;
  tenantId: string;
}): Promise<void> {
  const { ref } = await assertTicketOwned(input.ticketId, input.tenantId);
  const msgs = await ref.collection("messages").limit(500).get();
  const batch = getFirebaseFirestore().batch();
  for (const d of msgs.docs) {
    batch.delete(d.ref);
  }
  batch.delete(ref);
  await batch.commit();
}
