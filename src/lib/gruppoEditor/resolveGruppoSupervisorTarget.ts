import "server-only";
import type { SessionUser } from "@/lib/permissions";
import { usersDbFromUser } from "@/lib/usersRepo";

/** Supervisor che riceve la modifica (proprio o altro supervisor del tenant). */
export async function resolveGruppoSupervisorTarget(
  actor: SessionUser,
  gruppoSupervisorIdRaw: string | null | undefined
): Promise<string> {
  const targetId = String(gruppoSupervisorIdRaw || "").trim() || actor.id;
  if (targetId === actor.id) return actor.id;

  const sup = await usersDbFromUser(actor).findFirst({
    where: {
      id: targetId,
      tenantId: actor.tenantId,
      role: "SUPERVISOR",
      active: true,
    },
    select: { id: true },
  });
  if (!sup) throw new Error("Gruppo supervisor non valido");
  return sup.id;
}
