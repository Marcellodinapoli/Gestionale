"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { praticaWhere } from "@/lib/domain";
import { requireWritableUser } from "@/lib/guard";
import { markMessaggiLetti } from "@/lib/memoAgenda";

function fail(message: string): never {
  throw new Error(message);
}

export async function markMessaggioAgendaLettoAction(formData: FormData) {
  await requireWritableUser();
  const id = String(formData.get("messageId") || "");
  const msg = await prisma.messaggioAgenda.findUnique({
    where: { id },
    include: { pratica: { select: { id: true } } },
  });
  if (!msg) fail("Messaggio non trovato");
  await prisma.messaggioAgenda.update({
    where: { id },
    data: { letto: true, lettoAt: new Date() },
  });
  revalidatePath("/agenda");
  revalidatePath("/messaggi");
  if (msg.praticaId) revalidatePath(`/pratiche/${msg.praticaId}`);
}

/** Segna come letti i messaggi agenda legati alla pratica (senza togliere il richiamo). */
export async function markMessaggiPraticaLettiAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  if (!praticaId) fail("Pratica mancante");
  const pratica = await prisma.pratica.findFirst({
    where: { id: praticaId, ...praticaWhere(user) },
    select: { id: true },
  });
  if (!pratica) fail("Pratica non trovata");
  await markMessaggiLetti(praticaId);
  revalidatePath("/agenda");
  revalidatePath("/messaggi");
  revalidatePath(`/pratiche/${praticaId}`);
}
