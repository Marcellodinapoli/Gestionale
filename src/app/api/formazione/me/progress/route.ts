import { NextResponse } from "next/server";
import { requireApiModule, requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import { loadCollaboratorProgress } from "@/lib/formazione/collaboratorProgress";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import { checkFirebaseOrError } from "@/lib/formazione/firebaseGuard";
import {
  createFormazioneCustomToken,
  provisionFirebaseUserForGestionale,
} from "@/lib/formazione/provisionFirebaseUser";
import { progressSnapshotToJson } from "@/lib/formazione/serializeProgress";

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
    const progress = await loadCollaboratorProgress(getFirebaseFirestore(), uid);
    let token: string | undefined;
    try {
      token = await createFormazioneCustomToken(userOrRes, uid);
    } catch {
      token = undefined;
    }
    return NextResponse.json({
      uid,
      token,
      progress: progressSnapshotToJson(progress),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Errore caricamento progressi";
    const message =
      /invalid_grant|Invalid JWT Signature/i.test(raw)
        ? "Credenziali Firebase Admin non valide sul server."
        : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
