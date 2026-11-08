import { NextResponse } from "next/server";
import { requireApiModule, requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import { checkFirebaseOrError } from "@/lib/formazione/firebaseGuard";
import {
  createFormazioneCustomToken,
  provisionFirebaseUserForGestionale,
} from "@/lib/formazione/provisionFirebaseUser";

export async function GET() {
  const userOrRes = await requireApiUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    assertCan(userOrRes, "formazione:view");
  } catch {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }
  const moduleDenied = await requireApiModule(userOrRes, "formazione");
  if (moduleDenied) return moduleDenied;

  const fbError = checkFirebaseOrError();
  if (fbError) return fbError;

  try {
    const uid = await provisionFirebaseUserForGestionale(userOrRes);
    const token = await createFormazioneCustomToken(userOrRes, uid);

    return NextResponse.json({
      token,
      uid,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Errore collegamento CreditForm";
    const message =
      /invalid_grant|Invalid JWT Signature/i.test(raw)
        ? "Credenziali Firebase Admin non valide (chiave service account scaduta o errata). Aggiorna FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH e riavvia il server."
        : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
