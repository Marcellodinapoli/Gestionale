"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWritableUser } from "@/lib/guard";

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
  if (msg.praticaId) revalidatePath(`/pratiche/${msg.praticaId}`);
}
