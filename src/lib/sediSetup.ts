import { prisma } from "@/lib/prisma";
import { canManageSedi, type SessionUser } from "@/lib/permissions";

/** Admin/Amministrazione senza sedi configurate → wizard primo accesso. */
export async function needsSediSetup(
  user: Pick<SessionUser, "role" | "tenantId"> | null | undefined
) {
  if (!user || !canManageSedi(user)) return false;
  const n = await prisma.sede.count({
    where: { tenantId: user.tenantId, active: true },
  });
  return n === 0;
}
