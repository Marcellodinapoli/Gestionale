import { usersDb } from "@/lib/usersRepo";
import type { Prisma } from "@prisma/client";
import { isManutenzione, type SessionUser } from "@/lib/permissions";
import { parseGruppoMandanti } from "@/lib/gruppoMandanti";
import {
  formatUtenteNome,
  resolvePostazioneVisibile,
} from "@/lib/sessionPresence";

export type { GruppoLavoro } from "@/lib/gruppoLavoroUi";
import type { GruppoLavoro } from "@/lib/gruppoLavoroUi";

const membroGruppoSelect = {
  id: true,
  name: true,
  cognome: true,
  role: true,
  email: true,
  interno: true,
  postazioneId: true,
  postazioneFissa: true,
  lastLoginAt: true,
  lastLogoutAt: true,
  postazione: {
    select: {
      interno: true,
      email: true,
      nome: true,
    },
  },
} satisfies Prisma.UserSelect;

type MembroGruppoRow = Prisma.UserGetPayload<{ select: typeof membroGruppoSelect }>;

function toMembroGruppo(u: MembroGruppoRow) {
  const desk = resolvePostazioneVisibile({
    role: u.role,
    interno: u.interno,
    postazioneId: u.postazioneId,
    postazioneFissa: u.postazioneFissa,
    lastLoginAt: u.lastLoginAt,
    lastLogoutAt: u.lastLogoutAt,
    postazioneInterno: u.postazione?.interno,
    postazioneEmail: u.postazione?.email,
    postazioneNome: u.postazione?.nome,
  });
  return {
    id: u.id,
    name: formatUtenteNome(u),
    role: u.role,
    email: u.email,
    internoVisibile: desk.interno,
  };
}

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
      members: [
        {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          internoVisibile: user.interno?.trim() || null,
        },
      ],
      memberIds: [user.id],
    };
  }

  return getGruppoLavoroForSupervisor(user.tenantId, supervisorId);
}

/** Gruppo di lavoro di un supervisor (es. home back office con scelta gruppo). */
export async function getGruppoLavoroForSupervisor(
  tenantId: string,
  supervisorId: string
): Promise<GruppoLavoro> {
  const userModel = usersDb({ tenantId, tenantSlug: tenantId });
  const [supervisor, operators] = await Promise.all([
    userModel.findFirst({
      where: { id: supervisorId, tenantId },
      select: {
        ...membroGruppoSelect,
        active: true,
        gruppoNome: true,
        gruppoMandanti: true,
        tenantId: true,
      },
    }),
    userModel.findMany({
      where: {
        supervisorId,
        active: true,
        role: "OPERATOR",
        tenantId,
      },
      select: membroGruppoSelect,
      orderBy: { name: "asc" },
    }),
  ]);

  const members = [
    ...(supervisor?.active ? [toMembroGruppo(supervisor)] : []),
    ...operators.map((o) => toMembroGruppo(o)),
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
  // Sempre tutti i membri del gruppo (operatori + supervisor), mai solo l’utente corrente.
  return {
    OR: [
      { assegnatarioId: { in: memberIds } },
      { operatoreTitolareId: { in: memberIds } },
    ],
  };
}
