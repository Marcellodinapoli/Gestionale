"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import { rotateUserPassword } from "@/lib/passwordPolicy";
import bcrypt from "bcryptjs";

function fail(message: string): never {
  throw new Error(message);
}

export async function updateAcronimoAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const acronimo = String(formData.get("acronimo") || "").trim().toUpperCase() || null;
  if (!targetId) fail("Utente mancante");

  const target = await prisma.user.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");

  await prisma.user.update({
    where: { id: targetId },
    data: { acronimo },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `acronimo ${target.name}: ${acronimo || "rimosso"}`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function createOperatoreAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const acronimo = String(formData.get("acronimo") || "").trim().toUpperCase() || null;
  const role = String(formData.get("role") || "OPERATOR").trim();
  const supervisorId = String(formData.get("supervisorId") || "").trim() || null;

  if (!name || !email || !password) fail("Nome, email e password obbligatori");
  if (password.length < 6) fail("La password deve avere almeno 6 caratteri");

  const exists = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: user.tenantId, email } },
  });
  if (exists) fail("Email già in uso in questa azienda");

  if (supervisorId) {
    const sup = await prisma.user.findFirst({
      where: { id: supervisorId, tenantId: user.tenantId, role: "SUPERVISOR" },
    });
    if (!sup) fail("Supervisor non valido");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      tenantId: user.tenantId,
      name,
      email,
      passwordHash,
      passwordChangedAt: new Date(),
      role,
      acronimo,
      supervisorId,
    },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "create",
    entity: "user",
    dettaglio: `creato ${name} (${role})`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function deleteOperatoreAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  if (!targetId) fail("Utente mancante");

  const target = await prisma.user.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");
  if (target.id === user.id) fail("Non puoi eliminare te stesso");

  await prisma.user.update({
    where: { id: targetId },
    data: { active: false },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "delete",
    entity: "user",
    entityId: targetId,
    dettaglio: `disattivato ${target.name} (${target.role})`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function updateRuoloAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const role = String(formData.get("role") || "").trim();
  if (!targetId || !role) fail("Dati mancanti");

  const target = await prisma.user.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");

  await prisma.user.update({
    where: { id: targetId },
    data: { role },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `ruolo ${target.name}: ${target.role} → ${role}`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function resetPasswordAmministrazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const newPassword = String(formData.get("newPassword") || "").trim();
  if (!targetId || !newPassword) fail("Dati mancanti");
  if (newPassword.length < 6) fail("La password deve avere almeno 6 caratteri");

  const target = await prisma.user.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");

  await rotateUserPassword(targetId, newPassword);
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `reset password di ${target.name}`,
  });
}
