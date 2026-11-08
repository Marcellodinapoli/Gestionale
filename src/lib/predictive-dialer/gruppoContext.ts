import "server-only";
import type { SessionUser } from "@/lib/permissions";
import { canPickGruppoLavorazione } from "@/lib/permissions";
import { getGruppoLavoro, getGruppoLavoroForSupervisor, type GruppoLavoro } from "@/lib/gruppoLavoro";
import { usersDbFromUser } from "@/lib/usersRepo";

export type PredictiveGruppoContext = {
  canPickGruppo: boolean;
  supervisori: Array<{ id: string; name: string; gruppoNome: string | null }>;
  supervisorId: string;
  gruppo: GruppoLavoro;
};

/** Gruppo predictive (default proprio per supervisor, come Lavorazione / back office). */
export async function loadPredictiveGruppoContext(
  user: SessionUser,
  gruppoIdRaw?: string | null
): Promise<PredictiveGruppoContext> {
  const canPickGruppo = canPickGruppoLavorazione(user);
  const supervisori = canPickGruppo
    ? await usersDbFromUser(user).findMany({
        where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, gruppoNome: true },
      })
    : [];

  const isSupervisor = user.role === "SUPERVISOR";
  const targetSupervisorId =
    canPickGruppo && supervisori.length
      ? supervisori.some((s) => s.id === gruppoIdRaw)
        ? gruppoIdRaw!
        : isSupervisor
          ? user.id
          : supervisori[0]!.id
      : null;

  const gruppo = targetSupervisorId
    ? await getGruppoLavoroForSupervisor(user.tenantId, targetSupervisorId)
    : await getGruppoLavoro(user);

  const supervisorId = targetSupervisorId ?? gruppo.supervisorId ?? user.id;

  return { canPickGruppo, supervisori, supervisorId, gruppo };
}

export function operatoriDialerGruppo(
  gruppo: GruppoLavoro,
  supervisorId: string
): Array<{ id: string; name: string }> {
  return gruppo.members
    .filter((m) => m.role === "OPERATOR" || m.id === supervisorId)
    .map((m) => ({ id: m.id, name: m.name }));
}
