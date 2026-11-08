import "server-only";
import type { SessionUser } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export function dialerCampagnaScopeWhere(
  user: SessionUser,
  opts?: { gruppoSupervisorId?: string | null }
): Prisma.DialerCampagnaWhereInput {
  const base: Prisma.DialerCampagnaWhereInput = { tenantId: user.tenantId };
  if (user.role === "ADMIN") return base;
  if (user.role === "SUPERVISOR") {
    const supId = String(opts?.gruppoSupervisorId || "").trim() || user.id;
    return {
      AND: [
        base,
        {
          OR: [
            { supervisorId: supId },
            ...(supId === user.id ? [{ createdById: user.id }] : []),
            { operatori: { some: { operatore: { supervisorId: supId } } } },
          ],
        },
      ],
    };
  }
  return { id: "__nessuna__" };
}

export function canManageDialerCampagna(
  user: SessionUser,
  campagna: { supervisorId: string | null; createdById: string }
) {
  if (user.role === "ADMIN") return true;
  if (user.role === "SUPERVISOR") {
    if (campagna.createdById === user.id) return true;
    if (campagna.supervisorId) return true;
    return false;
  }
  return false;
}

export function parseCodiciScaricoJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

export function serializeCodiciScarico(codici: string[]): string {
  return JSON.stringify([...new Set(codici.map((c) => c.trim().toUpperCase()).filter(Boolean))]);
}
