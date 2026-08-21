"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type SbloccoPrivacyState = {
  ok: boolean;
  error?: string;
};

export async function sbloccaPrivacyAction(
  _prev: SbloccoPrivacyState,
  formData: FormData
): Promise<SbloccoPrivacyState> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sessione scaduta. Effettua di nuovo il login." };
  }

  const password = String(formData.get("password") || "").trim();
  if (!password) {
    return { ok: false, error: "Reinserisci la password" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, active: true },
  });
  if (!dbUser || !dbUser.active) {
    return { ok: false, error: "Utente non valido" };
  }

  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    return { ok: false, error: "Password non corretta" };
  }

  return { ok: true };
}
