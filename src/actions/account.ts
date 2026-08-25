"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireUser } from "@/lib/guard";
import { rotateUserPassword } from "@/lib/passwordPolicy";
import { validatePasswordComplexity } from "@/lib/passwordRules";

function fail(message: string): never {
  throw new Error(message);
}

function normalizzaInterno(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,6}$/.test(trimmed)) {
    fail("L'interno deve contenere solo cifre (max 6)");
  }
  return trimmed;
}

function normalizzaPrefisso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+#*]/g, "");
  if (!digits) fail("Prefisso non valido");
  return digits;
}

export async function updateAccountTelefoniaAction(formData: FormData) {
  const user = await requireUser();
  const interno = normalizzaInterno(String(formData.get("interno") || ""));
  const prefissoChiamata = normalizzaPrefisso(String(formData.get("prefissoChiamata") || ""));

  await prisma.user.update({
    where: { id: user.id },
    data: { interno, prefissoChiamata },
  });

  await writeAudit({
    userId: user.id,
    action: "account_telefonia",
    entity: "user",
    entityId: user.id,
    dettaglio: `int. ${interno || "—"} · pref. ${prefissoChiamata || "—"}`,
  });

  revalidatePath("/account");
  revalidatePath("/", "layout");
  revalidatePath("/pratiche");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser({ allowExpiredPassword: true });
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword) fail("Inserisci la password attuale");
  if (!newPassword) fail("Inserisci la nuova password");
  if (!confirmPassword) fail("Conferma la nuova password");
  const complexityErr = validatePasswordComplexity(newPassword);
  if (complexityErr) fail(complexityErr);
  if (newPassword !== confirmPassword) fail("Le password non coincidono");
  if (currentPassword === newPassword) {
    fail("La nuova password deve essere diversa da quella attuale");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) fail("Utente non trovato");

  const ok = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!ok) fail("Password attuale non corretta");

  await rotateUserPassword(user.id, newPassword);

  await writeAudit({
    userId: user.id,
    action: "password_change",
    entity: "user",
    entityId: user.id,
    dettaglio: "Cambio password self-service",
  });

  revalidatePath("/account");
  revalidatePath("/cambia-password");
  revalidatePath("/", "layout");
}
