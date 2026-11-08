import type { Auth } from "firebase/auth";
import { signInWithCustomToken } from "firebase/auth";

export type AssistenzaSessionPayload = {
  token?: string;
  error?: string;
};

/**
 * Allinea Firebase al ruolo corrente in Credixa (DB → custom token → ID token).
 * Da chiamare all'apertura del pannello e prima di ogni richiesta gestionaleHelp.
 */
export async function refreshAssistenzaFirebaseSession(auth: Auth): Promise<void> {
  const res = await fetch("/api/assistenza/session", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = (await res.json()) as AssistenzaSessionPayload;

  if (!res.ok) {
    throw new Error(payload.error ?? "Sessione assistenza non disponibile");
  }
  if (!payload.token) {
    throw new Error("Token assistenza mancante");
  }

  const cred = await signInWithCustomToken(auth, payload.token);
  await cred.user.getIdToken(true);
}
