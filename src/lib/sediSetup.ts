import { sediDbFromUser } from "@/lib/sediRepo";
import { canManageSedi, type SessionUser } from "@/lib/permissions";

/** Admin/Amministrazione senza sedi configurate → wizard primo accesso. */
export async function needsSediSetup(
  user: Pick<SessionUser, "role" | "tenantId" | "tenantSlug"> | null | undefined
) {
  if (!user || !canManageSedi(user)) return false;
  const n = await sediDbFromUser(user as SessionUser).count({
    where: { tenantId: user.tenantId, active: true },
  });
  return n === 0;
}
