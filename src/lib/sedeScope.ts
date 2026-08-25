import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions";

export {
  canManageSedi,
  canViewRendimentoAltreSedi,
  canViewRicaviIncassiAzienda,
} from "@/lib/permissions";

/**
 * Scope sede per pagine rendimento / filtri.
 * - Admin e Amministrazione: null = tutte (o sedeId da query)
 * - Altri: null (già limitati da ruolo/gruppo)
 */
export function sedeScopeForRendimento(
  user: SessionUser,
  sedeQuery?: string | null
): { sedeId: string | null; missingSede: boolean } {
  if (user.role === "ADMIN" || user.role === "AMMINISTRAZIONE") {
    const q = String(sedeQuery || "").trim();
    return { sedeId: q || null, missingSede: false };
  }
  return { sedeId: null, missingSede: false };
}

/**
 * Ricavi / fatturati (affidato, incassato, totali economici):
 * - Admin: sempre
 * - Amministrazione: solo quando il filtro sede è la propria
 * - Altri: già limitati dal ruolo
 */
export function canViewRicaviFatturatiSede(
  user: SessionUser,
  sedeScopeId: string | null
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "AMMINISTRAZIONE") {
    if (!user.sedeId) return false;
    return sedeScopeId === user.sedeId;
  }
  return true;
}

/** Id utenti attivi nella sede (appartenenza User.sedeId). */
export async function userIdsInSede(
  tenantId: string,
  sedeId: string | null
): Promise<string[] | null> {
  if (!sedeId) return null;
  const users = await prisma.user.findMany({
    where: { tenantId, active: true, sedeId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Interseca una lista di userId con lo scope sede (se presente). */
export function intersectUserIds(
  memberIds: string[],
  sedeUserIds: string[] | null
): string[] {
  if (!sedeUserIds) return memberIds;
  const set = new Set(sedeUserIds);
  return memberIds.filter((id) => set.has(id));
}
