import { usersDbFromUser } from "@/lib/usersRepo";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/admin";
import { isNeonProvider, getTenantsRepository, getUsersRepository } from "@/lib/data/factory";
import { neonQuery } from "@/lib/neon/pool";
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
  const emailNorm = email.trim().toLowerCase();

  if (gestionaleUserId) {
    const linked = await db
      .collection("users")
      .where("gestionaleUserId", "==", gestionaleUserId)
      .limit(1)
      .get();
    if (!linked.empty) return linked.docs[0]!.id;
  }

  if (emailNorm) {
    try {
      return (await auth.getUserByEmail(emailNorm)).uid;
    } catch {
      const byEmail = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!byEmail.empty) return byEmail.docs[0]!.id;
    }
  }

  return null;
}

/** Uid Firebase della sessione corrente (i miei progressi). */
export async function resolveOwnFirebaseUid(user: SessionUser): Promise<string | null> {
  const fromId = await resolveFirebaseUid(user.id, user.email);
  if (fromId) return fromId;
  if (isNeonProvider()) {
    const tenantId = await resolveNeonTenantId(user);
    if (tenantId) {
      const neonUser = await getUsersRepository().findByEmail(tenantId, user.email);
      if (neonUser?.id) {
        const fromNeon = await resolveFirebaseUid(neonUser.id, user.email);
        if (fromNeon) return fromNeon;
      }
    }
  }
  return null;
}

async function isOwnFirebaseUid(user: SessionUser, firebaseUid: string): Promise<boolean> {
  const own = await resolveOwnFirebaseUid(user);
  if (own && own === firebaseUid) return true;
  const emailNorm = user.email.trim().toLowerCase();
  if (!emailNorm) return false;
  try {
    const authUser = await getFirebaseAuth().getUser(firebaseUid);
    if (authUser.email?.trim().toLowerCase() === emailNorm) return true;
  } catch {
    /* ignore */
  }
  const snap = await getFirebaseFirestore().collection("users").doc(firebaseUid).get();
  const fbEmail = String(snap.data()?.email ?? "").trim().toLowerCase();
  return Boolean(fbEmail && fbEmail === emailNorm);
}

async function resolveNeonTenantId(user: SessionUser): Promise<string | null> {
  if (isUuid(user.tenantId)) return user.tenantId;
  const slug = user.tenantSlug?.trim();
  if (slug && !isUuid(slug)) {
    const tenant = await getTenantsRepository().getBySlug(slug);
    if (tenant?.id && isUuid(tenant.id)) return tenant.id;
  }
  const email = user.email?.trim();
  if (!email) return null;
  const rows = await neonQuery<{ TenantId: string }>(
    `SELECT u."TenantId" FROM "Users" u WHERE lower(u."Email") = lower($1) LIMIT 1`,
    [email]
  );
  const id = rows[0]?.TenantId != null ? String(rows[0].TenantId) : "";
  return isUuid(id) ? id : null;
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
    if (!tenantId) return [];
    let supervisorId: string | undefined;
    if (user.role === "SUPERVISOR") {
      supervisorId = isUuid(user.id) ? user.id : undefined;
      if (!supervisorId) {
        const me = await getUsersRepository().findByEmail(tenantId, user.email);
        supervisorId = me?.id && isUuid(me.id) ? me.id : undefined;
      }
      if (!supervisorId) return [];
    }
    const listed = await getUsersRepository().listByTenant(tenantId);
    return listed
      .filter((row) => {
        if (String(row.role || "").toUpperCase() !== "OPERATOR") return false;
        if (row.active === false) return false;
        if (supervisorId && row.supervisorId !== supervisorId) return false;
        return true;
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "it"))
      .map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        active: row.active !== false,
        createdAt: new Date(),
      }));
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
  if (await isOwnFirebaseUid(user, firebaseUid)) return;
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
