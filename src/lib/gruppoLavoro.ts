import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isManutenzione, type SessionUser } from "@/lib/permissions";
import { parseGruppoMandanti, type GruppoMandanteAssegnazione } from "@/lib/gruppoMandanti";

export type GruppoLavoro = {
  supervisorId: string | null;
  supervisorName: string | null;
  gruppoNome: string | null;
  gruppoMandanti: GruppoMandanteAssegnazione[];
  members: Array<{ id: string; name: string; role: string; email: string }>;
  memberIds: string[];
};

export async function getGruppoLavoro(user: SessionUser): Promise<GruppoLavoro> {
  if (isManutenzione(user)) {
    return {
      supervisorId: null,
      supervisorName: null,
      gruppoNome: null,
      gruppoMandanti: [],
      members: [],
      memberIds: [],
    };
  }
  const supervisorId =
    user.role === "SUPERVISOR" ? user.id : user.supervisorId;
  const nelGruppo =
    user.role === "SUPERVISOR" ||
    (user.role === "OPERATOR" && Boolean(user.supervisorId));

  if (!supervisorId || !nelGruppo) {
    return {
      supervisorId: user.supervisorId,
      supervisorName: null,
      gruppoNome: null,
      gruppoMandanti: [],
      members: [{ id: user.id, name: user.name, role: user.role, email: user.email }],
      memberIds: [user.id],
    };
  }

  const [supervisor, operators] = await Promise.all([
    prisma.user.findFirst({
      where: { id: supervisorId, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
        email: true,
        gruppoNome: true,
        gruppoMandanti: true,
        tenantId: true,
      },
    }),
    prisma.user.findMany({
      where: {
        supervisorId,
        active: true,
        role: "OPERATOR",
        tenantId: user.tenantId,
      },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const members = [
    ...(supervisor?.active
      ? [{ id: supervisor.id, name: supervisor.name, role: supervisor.role, email: supervisor.email }]
      : []),
    ...operators.map((o) => ({ id: o.id, name: o.name, role: o.role, email: o.email })),
  ];

  const memberIds = [...new Set(members.map((m) => m.id))];

  return {
    supervisorId,
    supervisorName: supervisor?.name ?? null,
    gruppoNome: supervisor?.gruppoNome ?? null,
    gruppoMandanti: parseGruppoMandanti(supervisor?.gruppoMandanti),
    members,
    memberIds,
  };
}

export function gruppoLavoroPraticaWhere(memberIds: string[]): Prisma.PraticaWhereInput {
  if (!memberIds.length) return { assegnatarioId: { in: [] } };
  return { assegnatarioId: { in: memberIds } };
}
