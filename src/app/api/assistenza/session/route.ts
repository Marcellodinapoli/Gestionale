import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import {
  firebaseFieldValue,
  getFirebaseAuth,
  getFirebaseFirestore,
} from "@/lib/firebase/admin";
import { checkFirebaseOrError } from "@/lib/formazione/firebaseGuard";

export const runtime = "nodejs";

export async function GET() {
  const userOrRes = await requireApiUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    assertCan(userOrRes, "assistenza:view");
  } catch {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const fbError = checkFirebaseOrError();
  if (fbError) return fbError;

  try {
    const auth = getFirebaseAuth();
    const db = getFirebaseFirestore();

    let firebaseUser;
    try {
      firebaseUser = await auth.getUserByEmail(userOrRes.email);
    } catch {
      firebaseUser = await auth.createUser({
        email: userOrRes.email,
        displayName: userOrRes.name,
        emailVerified: true,
      });
    }

    const FieldValue = firebaseFieldValue();
    const userRef = db.collection("users").doc(firebaseUser.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set(
        {
          email: userOrRes.email,
          displayName: userOrRes.name,
          gestionaleUserId: userOrRes.id,
          gestionaleTenantId: userOrRes.tenantId,
          createdAt: FieldValue.serverTimestamp(),
          source: "gestionale",
        },
        { merge: true },
      );
    }

    await userRef.set(
      {
        displayName: userOrRes.name,
        gestionaleUserId: userOrRes.id,
        gestionaleTenantId: userOrRes.tenantId,
        gestionaleAssistenzaRole: userOrRes.role,
        gestionaleAssistenzaRoleSyncedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const token = await auth.createCustomToken(firebaseUser.uid, {
      gestionaleUserId: userOrRes.id,
      gestionaleRole: userOrRes.role,
    });

    return NextResponse.json({
      token,
      uid: firebaseUser.uid,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Errore sessione assistenza Credixa Suite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
