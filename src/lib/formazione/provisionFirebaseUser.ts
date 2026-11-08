import "server-only";
import {
  firebaseFieldValue,
  getFirebaseAuth,
  getFirebaseFirestore,
} from "@/lib/firebase/admin";
import type { SessionUser } from "@/lib/permissions";

/** Crea/collega l'utente Firebase CreditForm per l'utente gestionale corrente. */
export async function provisionFirebaseUserForGestionale(
  user: SessionUser
): Promise<string> {
  const auth = getFirebaseAuth();
  const db = getFirebaseFirestore();
  const email = user.email.trim().toLowerCase();

  let firebaseUser;
  try {
    firebaseUser = await auth.getUserByEmail(email);
  } catch {
    firebaseUser = await auth.createUser({
      email,
      displayName: user.name,
      emailVerified: true,
    });
  }

  const FieldValue = firebaseFieldValue();
  const userRef = db.collection("users").doc(firebaseUser.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await userRef.set(
      {
        email: user.email,
        displayName: user.name,
        gestionaleUserId: user.id,
        gestionaleTenantId: user.tenantId,
        createdAt: FieldValue.serverTimestamp(),
        source: "gestionale",
      },
      { merge: true }
    );
  } else {
    await userRef.set(
      {
        displayName: user.name,
        gestionaleUserId: user.id,
        gestionaleTenantId: user.tenantId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return firebaseUser.uid;
}

export async function createFormazioneCustomToken(
  user: SessionUser,
  uid: string
): Promise<string> {
  const auth = getFirebaseAuth();
  return auth.createCustomToken(uid, {
    gestionaleUserId: user.id,
    gestionaleRole: user.role,
  });
}
