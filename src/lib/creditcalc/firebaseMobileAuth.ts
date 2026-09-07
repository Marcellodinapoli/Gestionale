import "server-only";
import { getFirebaseAuth } from "@/lib/firebase/admin";

export type CreditCalcFirebaseUser = {
  uid: string;
  email: string | null;
};

/** Autenticazione mobile CreditCalc: Bearer Firebase ID token. */
export async function requireCreditCalcFirebaseUser(
  req: Request
): Promise<CreditCalcFirebaseUser | { error: string; status: number }> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return { error: "Token Firebase mancante", status: 401 };
  }
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(match[1].trim());
    if (!decoded.uid) {
      return { error: "Token non valido", status: 401 };
    }
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
    };
  } catch {
    return { error: "Token Firebase non valido o scaduto", status: 401 };
  }
}
