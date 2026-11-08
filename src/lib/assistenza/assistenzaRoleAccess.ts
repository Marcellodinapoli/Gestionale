import { can, type Role, type SessionUser } from "@/lib/permissions";

/** Ruolo con permesso `assistenza:view` (allineato a MAP in permissions.ts). */
export function isAssistenzaViewRole(role: Role | string): boolean {
  return can({ role: role as Role } as SessionUser, "assistenza:view");
}

export type AssistenzaDbRoleOutcome =
  | { status: "allowed"; role: Role }
  | { status: "inactive" }
  | { status: "not_found" }
  | { status: "no_assistenza" };

/**
 * Esito verifica ruolo da sessione DB (Neon/Prisma via loadSessionUser).
 * Nessun dato personale oltre al ruolo.
 */
export function outcomeFromSessionUser(
  user: { active: boolean; role: Role } | null | undefined,
): AssistenzaDbRoleOutcome {
  if (!user) return { status: "not_found" };
  if (!user.active) return { status: "inactive" };
  if (!isAssistenzaViewRole(user.role)) return { status: "no_assistenza" };
  return { status: "allowed", role: user.role };
}
