"use server";

import { revalidatePath } from "next/cache";
import { praticaWhere } from "@/lib/domain";
import { requireWritableUser } from "@/lib/guard";
import { markMessaggiLetti } from "@/lib/memoAgenda";
import { messaggiAgendaFromUser } from "@/lib/messaggiAgendaRepo";
import { praticaDbFromUser, resolveTenantSlug } from "@/lib/praticheRepo";

function fail(message: string): never {
  throw new Error(message);
}

export async function markMessaggioAgendaLettoAction(formData: FormData) {
  const user = await requireWritableUser();
  const id = String(formData.get("messageId") || "");
  const repo = messaggiAgendaFromUser(user);
  const tenantSlug = resolveTenantSlug(user);
  const msg = await repo.getById(tenantSlug, user.tenantId, id);
  if (!msg) fail("Messaggio non trovato");
  await repo.markLetto(tenantSlug, user.tenantId, id);
  revalidatePath("/agenda");
  revalidatePath("/messaggi");
  if (msg.praticaId) revalidatePath(`/pratiche/${msg.praticaId}`);
}

/** Segna come letti i messaggi agenda legati alla pratica (senza togliere il richiamo). */
export async function markMessaggiPraticaLettiAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  if (!praticaId) fail("Pratica mancante");
  const pratica = await praticaDbFromUser(user).findFirst({
    where: { id: praticaId, ...praticaWhere(user) },
    select: { id: true },
  });
  if (!pratica) fail("Pratica non trovata");
  await markMessaggiLetti(praticaId, user.tenantId, resolveTenantSlug(user));
  revalidatePath("/agenda");
  revalidatePath("/messaggi");
  revalidatePath(`/pratiche/${praticaId}`);
}
