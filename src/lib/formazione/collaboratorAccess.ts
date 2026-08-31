import { usersDbFromUser } from "@/lib/usersRepo";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/admin";
import type { SessionUser } from "@/lib/permissions";

export type CollaboratorRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  firebaseUid: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
};

async function resolveFirebaseUid(gestionaleUserId: string, email: string): Promise<string | null> {
  const db = getFirebaseFirestore();
  const auth = getFirebaseAuth();

  const linked = await db
    .collection("users")
    .where("gestionaleUserId", "==", gestionaleUserId)
    .limit(1)
    .get();
  if (!linked.empty) return linked.docs[0]!.id;

  try {
    return (await auth.getUserByEmail(email)).uid;
  } catch {
    return null;
  }
}

export async function listCollaboratorsForSupervisor(
  user: SessionUser
): Promise<CollaboratorRow[]> {
  const where =
    user.role === "ADMIN"
      ? { tenantId: user.tenantId, role: "OPERATOR" as const, active: true }
      : {
          tenantId: user.tenantId,
          role: "OPERATOR" as const,
          active: true,
          supervisorId: user.id,
        };

  const operators = await usersDbFromUser(user).findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
    },
  });

  const rows = await Promise.all(
    operators.map(async (op) => {
      const firebaseUid = await resolveFirebaseUid(op.id, op.email);
      let lastLoginAt: string | null = null;
      if (firebaseUid) {
        const snap = await getFirebaseFirestore().collection("users").doc(firebaseUid).get();
        const raw = snap.data()?.lastLoginAt;
        if (raw && typeof raw === "object" && "toDate" in raw) {
          lastLoginAt = (raw as { toDate: () => Date }).toDate().toISOString();
        }
      }
      return {
        id: op.id,
        name: op.name,
        email: op.email,
        active: op.active,
        firebaseUid,
        createdAt: op.createdAt.toISOString(),
        lastLoginAt,
      };
    })
  );

  return rows;
}

export async function assertSupervisorCanViewFirebaseUid(
  user: SessionUser,
  firebaseUid: string
): Promise<{ gestionaleUserId: string; name: string; email: string }> {
  const db = getFirebaseFirestore();
  const fbUser = await db.collection("users").doc(firebaseUid).get();
  const data = fbUser.data();

  let gestionaleUserId = String(data?.gestionaleUserId ?? "").trim();
  let email = String(data?.email ?? "").trim();

  if (!gestionaleUserId && email) {
    const byEmail = await usersDbFromUser(user).findFirst({
      where: { tenantId: user.tenantId, email },
      select: { id: true, name: true, email: true, supervisorId: true, role: true },
    });
    if (byEmail) {
      gestionaleUserId = byEmail.id;
      email = byEmail.email;
    }
  }

  if (!gestionaleUserId) {
    throw new Error("Collaboratore non collegato al gestionale");
  }

  const operator = await usersDbFromUser(user).findFirst({
    where: { id: gestionaleUserId, tenantId: user.tenantId, role: "OPERATOR" },
    select: { id: true, name: true, email: true, supervisorId: true },
  });

  if (!operator) {
    throw new Error("Operatore non trovato");
  }

  if (user.role === "SUPERVISOR" && operator.supervisorId !== user.id) {
    throw new Error("Non autorizzato");
  }

  return { gestionaleUserId: operator.id, name: operator.name, email: operator.email };
}

export async function resolveFirebaseUidForGestionaleOperator(
  gestionaleUserId: string,
  email: string
): Promise<string | null> {
  return resolveFirebaseUid(gestionaleUserId, email);
}
