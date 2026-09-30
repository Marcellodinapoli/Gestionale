"use server";

import { createSession } from "@/lib/auth";
import {
  authenticateLogin,
  mapLoginException,
  type LoginInput,
} from "@/lib/loginCore";

export async function loginAction(
  input: LoginInput
): Promise<{ error: string } | { ok: true; href: string }> {
  try {
    const result = await authenticateLogin(input);
    if ("error" in result) return result;
    // Chiude eventuale sessione precedente (cambio account senza "Esci"):
    // rilascia postazione e aggiorna lastLogoutAt del vecchio utente.
    const { endUserSession } = await import("@/lib/sessionLogout");
    await endUserSession();
    await createSession(result.session);
    return { ok: true, href: result.href };
  } catch (e) {
    return mapLoginException(e);
  }
}
