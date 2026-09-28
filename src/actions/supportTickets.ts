"use server";

import { revalidatePath } from "next/cache";
import { requireWritableUser } from "@/lib/guard";
import {
  createSupportTicket,
  deleteSupportTicket,
  replyToSupportTicket,
  updateSupportTicket,
} from "@/lib/support/credixaSupport";

function fail(message: string): never {
  throw new Error(message);
}

async function requireAdminTicketUser() {
  const user = await requireWritableUser();
  if (user.role !== "ADMIN") fail("Solo l'admin può gestire i ticket di assistenza");
  return user;
}

export async function apriTicketAssistenza(formData: FormData) {
  const user = await requireAdminTicketUser();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  if (!subject) fail("Oggetto obbligatorio");
  if (!message) fail("Messaggio obbligatorio");

  await createSupportTicket({
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? null,
    tenantName: user.tenantNome ?? null,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    subject,
    message,
  });

  revalidatePath("/ticket");
}

export async function rispondiTicketAssistenza(formData: FormData) {
  const user = await requireAdminTicketUser();
  const ticketId = String(formData.get("ticketId") || "").trim();
  const text = String(formData.get("message") || "").trim();
  if (!ticketId) fail("Ticket non valido");
  if (!text) fail("Messaggio obbligatorio");

  await replyToSupportTicket({
    ticketId,
    tenantId: user.tenantId,
    text,
  });

  revalidatePath("/ticket");
}

export async function modificaTicketAssistenza(formData: FormData) {
  const user = await requireAdminTicketUser();
  const ticketId = String(formData.get("ticketId") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const firstMessageId = String(formData.get("firstMessageId") || "").trim() || null;
  if (!ticketId) fail("Ticket non valido");
  if (!subject) fail("Oggetto obbligatorio");
  if (!message) fail("Messaggio obbligatorio");

  await updateSupportTicket({
    ticketId,
    tenantId: user.tenantId,
    subject,
    firstMessageId,
    firstMessageText: message,
  });

  revalidatePath("/ticket");
}

export async function eliminaTicketAssistenza(formData: FormData) {
  const user = await requireAdminTicketUser();
  const ticketId = String(formData.get("ticketId") || "").trim();
  if (!ticketId) fail("Ticket non valido");

  await deleteSupportTicket({
    ticketId,
    tenantId: user.tenantId,
  });

  revalidatePath("/ticket");
}
