import "server-only";
import type { SessionUser } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export function dialerCampagnaScopeWhere(user: SessionUser): Prisma.DialerCampagnaWhereInput {
  const base: Prisma.DialerCampagnaWhereInput = { tenantId: user.tenantId };
  if (user.role === "ADMIN") return base;
  if (user.role === "SUPERVISOR") {
    return {
      AND: [
        base,
        {
          OR: [
            { supervisorId: user.id },
            { createdById: user.id },
            { operatori: { some: { operatore: { supervisorId: user.id } } } },
          ],
        },
      ],
    };
  }
  return { id: "__nessuna__" };
}

export function canManageDialerCampagna(user: SessionUser, campagna: { supervisorId: string | null; createdById: string }) {
  if (user.role === "ADMIN") return true;
  if (user.role === "SUPERVISOR") {
    return campagna.supervisorId === user.id || campagna.createdById === user.id;
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
