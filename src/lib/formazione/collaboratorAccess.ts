import { usersDbFromUser } from "@/lib/usersRepo";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/admin";
import { isNeonProvider, getTenantsRepository, getUsersRepository } from "@/lib/data/factory";
import { createNeonUsersAdminRepository } from "@/lib/neon/NeonUsersAdminRepository";
import { isUuid } from "@/lib/tenant";
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

async function resolveNeonTenantId(user: SessionUser): Promise<string | null> {
  if (isUuid(user.tenantId)) return user.tenantId;
  const slug = user.tenantSlug?.trim();
  if (!slug) return null;
  const tenant = await getTenantsRepository().getBySlug(slug);
  return tenant?.id && isUuid(tenant.id) ? tenant.id : null;
}

async function listOperatorsForCollaboratori(user: SessionUser): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    active: boolean;
    createdAt: Date;
  }>
> {
  if (isNeonProvider()) {
    const tenantId = await resolveNeonTenantId(user);
    if (tenantId) {
      let supervisorId: string | undefined;
      if (user.role === "SUPERVISOR") {
        supervisorId = isUuid(user.id) ? user.id : undefined;
        if (!supervisorId) {
          const me = await getUsersRepository().findByEmail(tenantId, user.email);
          supervisorId = me?.id && isUuid(me.id) ? me.id : undefined;
        }
        if (!supervisorId) return [];
      }
      const listed = await createNeonUsersAdminRepository(user.tenantSlug || "").list({
        tenantSlug: user.tenantSlug || "",
        tenantId,
        filter: {
          role: "OPERATOR",
          active: true,
          ...(supervisorId ? { supervisorId } : {}),
        },
        orderBy: { name: "asc" },
        take: 500,
      });
      return listed.items.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        active: row.active !== false,
        createdAt:
          row.createdAt instanceof Date
            ? row.createdAt
            : new Date(String(row.createdAt ?? Date.now())),
      }));
    }
  }

  const where =
    user.role === "ADMIN"
      ? { tenantId: user.tenantId, role: "OPERATOR" as const, active: true }
      : {
          tenantId: user.tenantId,
          role: "OPERATOR" as const,
          active: true,
          supervisorId: user.id,
        };

  return usersDbFromUser(user).findMany({
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
}

export async function listCollaboratorsForSupervisor(
  user: SessionUser
): Promise<CollaboratorRow[]> {
  const operators = await listOperatorsForCollaboratori(user);

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

/** Il collaboratore può vedere il proprio corso; supervisor/admin i collaboratori. */
export async function assertCanViewCollaboratorCourse(
  user: SessionUser,
  firebaseUid: string
) {
  const ownUid = await resolveFirebaseUid(user.id, user.email);
  if (ownUid && ownUid === firebaseUid) return;
  if (user.role !== "SUPERVISOR" && user.role !== "ADMIN") {
    throw new Error("Non autorizzato");
  }
  await assertSupervisorCanViewFirebaseUid(user, firebaseUid);
}

export async function resolveFirebaseUidForGestionaleOperator(
  gestionaleUserId: string,
  email: string
): Promise<string | null> {
  return resolveFirebaseUid(gestionaleUserId, email);
}
