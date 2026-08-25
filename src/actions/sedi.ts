"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireWritableUser } from "@/lib/guard";
import { canManageSedi } from "@/lib/permissions";

async function requireSediManager() {
  const user = await requireWritableUser();
  if (!canManageSedi(user)) {
    throw new Error("Operazione non consentita per il tuo ruolo");
  }
  return user;
}

export async function creaSedeAction(formData: FormData) {
  const user = await requireSediManager();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Nome obbligatorio");

  const exists = await prisma.sede.findUnique({
    where: { tenantId_nome: { tenantId: user.tenantId, nome } },
  });
  if (exists) throw new Error("Nome sede già esistente");

  const sede = await prisma.sede.create({
    data: { tenantId: user.tenantId, nome, active: true },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "crea_sede",
    entity: "sede",
    entityId: sede.id,
    dettaglio: nome,
  });
  revalidatePath("/sedi");
  revalidatePath("/postazioni");
  revalidatePath("/operatori");
  redirect("/sedi");
}

export async function aggiornaSedeAction(formData: FormData) {
  const user = await requireSediManager();
  const id = String(formData.get("id") || "");
  const nome = String(formData.get("nome") || "").trim();
  if (!id || !nome) throw new Error("Dati mancanti");

  const current = await prisma.sede.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!current) throw new Error("Sede non trovata");

  const duplicato = await prisma.sede.findFirst({
    where: { tenantId: user.tenantId, nome, NOT: { id } },
  });
  if (duplicato) throw new Error("Nome sede già esistente");

  await prisma.sede.update({ where: { id }, data: { nome } });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "aggiorna_sede",
    entity: "sede",
    entityId: id,
    dettaglio: `${current.nome} → ${nome}`,
  });
  revalidatePath("/sedi");
  revalidatePath("/postazioni");
  revalidatePath("/operatori");
  redirect("/sedi");
}

export async function toggleSedeAction(formData: FormData) {
  const user = await requireSediManager();
  const id = String(formData.get("id") || "");
  const sede = await prisma.sede.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!sede) return;

  await prisma.sede.update({
    where: { id },
    data: { active: !sede.active },
  });
  revalidatePath("/sedi");
  revalidatePath("/postazioni");
  redirect("/sedi");
}
