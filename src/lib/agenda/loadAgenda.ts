import "server-only";
import { prisma } from "@/lib/prisma";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import type { SessionUser } from "@/lib/permissions";
import type {
  AgendaCalendarioBundle,
  AgendaScopeContext,
  MemoAlertsRawBundle,
} from "@/lib/data/contracts/agenda";

export async function loadFirestoreAgendaCalendario(
  user: SessionUser,
  impegniUserId: string
): Promise<AgendaCalendarioBundle> {
  const baseScope = await praticaScopeWhere(user);
  const [pratiche, impegni] = await Promise.all([
    prisma.pratica.findMany({
      where: { AND: [baseScope, { memoAt: { not: null } }] },
      include: {
        debitore: { select: { nome: true, cognome: true } },
        assegnatario: { select: { name: true } },
        mandante: { select: { codice: true } },
      },
      orderBy: { memoAt: "asc" },
      take: 200,
    }),
    prisma.impegnoAgenda.findMany({
      where: { userId: impegniUserId, completato: false },
      include: { user: { select: { name: true } } },
      orderBy: { memoAt: "asc" },
      take: 200,
    }),
  ]);

  return {
    pratiche: pratiche.map((p) => ({
      id: p.id,
      numero: p.numero,
      memoAt: p.memoAt!.toISOString(),
      tipoContatto: p.tipoContatto,
      esitoContatto: p.esitoContatto,
      debitore: p.debitore,
      assegnatario: p.assegnatario,
      mandante: p.mandante,
      telefono: null,
    })),
    impegni: impegni.map((i) => ({
      id: i.id,
      userId: i.userId,
      titolo: i.titolo,
      nota: i.nota,
      memoAt: i.memoAt.toISOString(),
      completato: i.completato,
      userName: i.user?.name,
    })),
  };
}

export async function loadFirestoreAgendaGiorno(
  user: SessionUser,
  impegniUserId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<AgendaCalendarioBundle> {
  const baseScope = await praticaScopeWhere(user);
  const [pratiche, impegni] = await Promise.all([
    prisma.pratica.findMany({
      where: { AND: [baseScope, { memoAt: { gte: dayStart, lte: dayEnd } }] },
      include: {
        debitore: { select: { nome: true, cognome: true } },
        assegnatario: { select: { name: true } },
        mandante: { select: { codice: true } },
      },
      orderBy: { memoAt: "asc" },
      take: 100,
    }),
    prisma.impegnoAgenda.findMany({
      where: {
        userId: impegniUserId,
        completato: false,
        memoAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { memoAt: "asc" },
      take: 100,
    }),
  ]);

  return {
    pratiche: pratiche.map((p) => ({
      id: p.id,
      numero: p.numero,
      memoAt: p.memoAt!.toISOString(),
      debitore: p.debitore,
      assegnatario: p.assegnatario,
      mandante: p.mandante,
    })),
    impegni: impegni.map((i) => ({
      id: i.id,
      userId: i.userId,
      titolo: i.titolo,
      nota: i.nota,
      memoAt: i.memoAt.toISOString(),
      completato: i.completato,
    })),
  };
}

export async function loadFirestoreMemoAlertsRaw(
  user: SessionUser,
  opts: {
    impegniUserId: string;
    canAgenda: boolean;
    memoAtGte: Date;
    memoAtLte: Date;
  }
): Promise<MemoAlertsRawBundle> {
  const baseScope = await praticaScopeWhere(user);

  const pratiche = opts.canAgenda
    ? await prisma.pratica.findMany({
        where: {
          AND: [baseScope, { memoAt: { gte: opts.memoAtGte, lte: opts.memoAtLte } }],
        },
        select: {
          id: true,
          numero: true,
          memoAt: true,
          debitore: { select: { nome: true, cognome: true, telefono: true } },
          mandante: { select: { codice: true } },
        },
        orderBy: { memoAt: "asc" },
        take: 50,
      })
    : [];

  const impegni = opts.canAgenda
    ? await prisma.impegnoAgenda.findMany({
        where: {
          userId: opts.impegniUserId,
          completato: false,
          memoAt: { gte: opts.memoAtGte, lte: opts.memoAtLte },
        },
        orderBy: { memoAt: "asc" },
        take: 50,
      })
    : [];

  const intern = await prisma.messaggioInterno.findMany({
    where: { toUserId: user.id, letto: false },
    include: {
      fromUser: { select: { name: true } },
      pratica: {
        select: {
          numero: true,
          debitore: { select: { nome: true, cognome: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  return {
    pratiche: pratiche.map((p) => ({
      id: p.id,
      numero: p.numero,
      memoAt: p.memoAt!.toISOString(),
      debitore: p.debitore,
      mandante: p.mandante,
      telefono: p.debitore.telefono,
    })),
    impegni: impegni.map((i) => ({
      id: i.id,
      userId: i.userId,
      titolo: i.titolo,
      nota: i.nota,
      memoAt: i.memoAt.toISOString(),
      completato: i.completato,
    })),
    intern: intern as unknown as Array<Record<string, unknown>>,
  };
}

export async function loadFirestoreMessaggiAgendaScoped(user: SessionUser) {
  const praticaScope = await praticaScopeWhere(user);
  return prisma.messaggioAgenda.findMany({
    where: { pratica: praticaScope },
    include: {
      pratica: {
        select: {
          id: true,
          numero: true,
          debitore: { select: { nome: true, cognome: true } },
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function loadAgendaCalendarioAuto(
  ctx: AgendaScopeContext,
  user: SessionUser,
  impegniUserId: string
) {
  const { isConnectorProvider } = await import("@/lib/data/factory");
  if (!isConnectorProvider()) return loadFirestoreAgendaCalendario(user, impegniUserId);
  const { createConnectorAgendaRepository } = await import(
    "@/lib/data/connector/ConnectorAgendaRepository"
  );
  return createConnectorAgendaRepository(ctx.tenantSlug).loadCalendario(ctx, impegniUserId);
}

export async function loadAgendaGiornoAuto(
  ctx: AgendaScopeContext,
  user: SessionUser,
  impegniUserId: string,
  dayStart: Date,
  dayEnd: Date
) {
  const { isConnectorProvider } = await import("@/lib/data/factory");
  if (!isConnectorProvider()) return loadFirestoreAgendaGiorno(user, impegniUserId, dayStart, dayEnd);
  const { createConnectorAgendaRepository } = await import(
    "@/lib/data/connector/ConnectorAgendaRepository"
  );
  return createConnectorAgendaRepository(ctx.tenantSlug).loadGiorno(
    ctx,
    impegniUserId,
    dayStart.toISOString(),
    dayEnd.toISOString()
  );
}

export async function loadMemoAlertsRawAuto(
  ctx: AgendaScopeContext,
  user: SessionUser,
  opts: {
    impegniUserId: string;
    canAgenda: boolean;
    memoAtGte: Date;
    memoAtLte: Date;
  }
) {
  const { isConnectorProvider } = await import("@/lib/data/factory");
  if (!isConnectorProvider()) return loadFirestoreMemoAlertsRaw(user, opts);
  const { createConnectorAgendaRepository } = await import(
    "@/lib/data/connector/ConnectorAgendaRepository"
  );
  return createConnectorAgendaRepository(ctx.tenantSlug).loadMemoAlertsRaw(ctx, {
    impegniUserId: opts.impegniUserId,
    canAgenda: opts.canAgenda,
    memoAtGte: opts.memoAtGte.toISOString(),
    memoAtLte: opts.memoAtLte.toISOString(),
  });
}

export async function loadMessaggiAgendaScopedAuto(ctx: AgendaScopeContext, user: SessionUser) {
  const { isConnectorProvider } = await import("@/lib/data/factory");
  if (!isConnectorProvider()) return loadFirestoreMessaggiAgendaScoped(user);
  const { createConnectorAgendaRepository } = await import(
    "@/lib/data/connector/ConnectorAgendaRepository"
  );
  return createConnectorAgendaRepository(ctx.tenantSlug).listMessaggiAgendaScoped(ctx);
}
