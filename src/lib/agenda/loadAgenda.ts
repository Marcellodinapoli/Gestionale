import "server-only";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { impegniAgendaFromUser } from "@/lib/impegniAgendaRepo";
import { messaggiInterniFromUser } from "@/lib/messaggiInterniRepo";
import { messaggiAgendaFromUser } from "@/lib/messaggiAgendaRepo";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import type { SessionUser } from "@/lib/permissions";
import type {
  AgendaCalendarioBundle,
  AgendaScopeContext,
  MemoAlertsRawBundle,
} from "@/lib/data/contracts/agenda";
import { expandScadenzeGiudiziali } from "@/lib/agenda/scadenzeGiudiziali";

async function loadGiudizialiScadenze(
  user: SessionUser,
  range?: { start?: Date; end?: Date }
) {
  const baseScope = await praticaScopeWhere(user);
  const rows = await praticaDbFromUser(user).findMany({
    where: {
      AND: [
        baseScope,
        { giudiziale: { isNot: null } },
      ],
    },
    select: {
      id: true,
      numero: true,
      debitore: { select: { nome: true, cognome: true } },
      assegnatario: { select: { name: true } },
      giudiziale: {
        select: {
          attivitaProceduraJson: true,
          agendaScadenze: true,
          dataAffidamentoGiudiziale: true,
          dataEsito: true,
        },
      },
    },
    take: 200,
  });

  return rows.flatMap((p) =>
    expandScadenzeGiudiziali({
      praticaId: p.id,
      numero: p.numero,
      debitore: p.debitore,
      assegnatarioName: p.assegnatario?.name,
      attivitaProceduraJson: p.giudiziale?.attivitaProceduraJson,
      agendaScadenze: p.giudiziale?.agendaScadenze,
      dataAffidamentoGiudiziale: p.giudiziale?.dataAffidamentoGiudiziale,
      dataEsito: p.giudiziale?.dataEsito,
      rangeStart: range?.start,
      rangeEnd: range?.end,
    })
  );
}

export async function loadPrismaAgendaCalendario(
  user: SessionUser,
  impegniUserId: string
): Promise<AgendaCalendarioBundle> {
  const baseScope = await praticaScopeWhere(user);
  const [pratiche, impegni, giudiziali] = await Promise.all([
    praticaDbFromUser(user).findMany({
      where: { AND: [baseScope, { memoAt: { not: null } }] },
      include: {
        debitore: { select: { nome: true, cognome: true } },
        assegnatario: { select: { name: true } },
        mandante: { select: { codice: true } },
      },
      orderBy: { memoAt: "asc" },
      take: 200,
    }),
    impegniAgendaFromUser(user).list(user.tenantSlug ?? user.tenantId, user.tenantId, {
      userId: impegniUserId,
      completato: false,
    }, 200),
    loadGiudizialiScadenze(user),
  ]);

  return {
    pratiche: pratiche.map((p) => ({
      id: p.id,
      numero: p.numero,
      memoAt: p.memoAt instanceof Date ? p.memoAt.toISOString() : String(p.memoAt ?? ""),
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
      memoAt: i.memoAt,
      completato: i.completato,
      userName: i.userName,
    })),
    giudiziali,
  };
}

export async function loadPrismaAgendaGiorno(
  user: SessionUser,
  impegniUserId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<AgendaCalendarioBundle> {
  const baseScope = await praticaScopeWhere(user);
  const [pratiche, impegni, giudiziali] = await Promise.all([
    praticaDbFromUser(user).findMany({
      where: { AND: [baseScope, { memoAt: { gte: dayStart, lte: dayEnd } }] },
      include: {
        debitore: { select: { nome: true, cognome: true } },
        assegnatario: { select: { name: true } },
        mandante: { select: { codice: true } },
      },
      orderBy: { memoAt: "asc" },
      take: 100,
    }),
    impegniAgendaFromUser(user).list(user.tenantSlug ?? user.tenantId, user.tenantId, {
      userId: impegniUserId,
      completato: false,
      memoAtGte: dayStart.toISOString(),
      memoAtLte: dayEnd.toISOString(),
    }, 100),
    loadGiudizialiScadenze(user, { start: dayStart, end: dayEnd }),
  ]);

  return {
    pratiche: pratiche.map((p) => ({
      id: p.id,
      numero: p.numero,
      memoAt: p.memoAt instanceof Date ? p.memoAt.toISOString() : String(p.memoAt ?? ""),
      debitore: p.debitore,
      assegnatario: p.assegnatario,
      mandante: p.mandante,
    })),
    impegni: impegni.map((i) => ({
      id: i.id,
      userId: i.userId,
      titolo: i.titolo,
      nota: i.nota,
      memoAt: i.memoAt,
      completato: i.completato,
    })),
    giudiziali,
  };
}

export async function loadPrismaMemoAlertsRaw(
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
    ? await praticaDbFromUser(user).findMany({
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
    ? await impegniAgendaFromUser(user).list(user.tenantSlug ?? user.tenantId, user.tenantId, {
        userId: opts.impegniUserId,
        completato: false,
        memoAtGte: opts.memoAtGte.toISOString(),
        memoAtLte: opts.memoAtLte.toISOString(),
      }, 50)
    : [];

  const giudiziali = opts.canAgenda
    ? await loadGiudizialiScadenze(user, {
        start: opts.memoAtGte,
        end: opts.memoAtLte,
      })
    : [];

  const intern = await messaggiInterniFromUser(user).list(
    user.tenantSlug ?? user.tenantId,
    user.tenantId,
    { toUserId: user.id, letto: false, take: 30 }
  );

  return {
    pratiche: pratiche.map((p) => ({
      id: p.id,
      numero: p.numero,
      memoAt: p.memoAt instanceof Date ? p.memoAt.toISOString() : String(p.memoAt ?? ""),
      debitore: p.debitore,
      mandante: p.mandante,
      telefono: p.debitore.telefono,
    })),
    impegni: impegni.map((i) => ({
      id: i.id,
      userId: i.userId,
      titolo: i.titolo,
      nota: i.nota,
      memoAt: i.memoAt,
      completato: i.completato,
    })),
    giudiziali,
    intern: intern as unknown as Array<Record<string, unknown>>,
  };
}

export async function loadPrismaMessaggiAgendaScoped(user: SessionUser) {
  // I messaggi agenda con praticaScope si caricano dalla lista generale
  // Il filtro praticaScope non è supportato direttamente dal repository messaggi agenda
  // Questo viene gestito dal ConnectorAgendaRepository quando necessario
  return messaggiAgendaFromUser(user).list(
    user.tenantSlug ?? user.tenantId,
    user.tenantId,
    { praticaScope: "tenant", take: 100 }
  );
}

export async function loadAgendaCalendarioAuto(
  ctx: AgendaScopeContext,
  user: SessionUser,
  impegniUserId: string
) {
  const { isConnectorProvider } = await import("@/lib/data/factory");
  if (!isConnectorProvider()) return loadPrismaAgendaCalendario(user, impegniUserId);
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
  if (!isConnectorProvider()) return loadPrismaAgendaGiorno(user, impegniUserId, dayStart, dayEnd);
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
  if (!isConnectorProvider()) return loadPrismaMemoAlertsRaw(user, opts);
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
  if (!isConnectorProvider()) return loadPrismaMessaggiAgendaScoped(user);
  const { createConnectorAgendaRepository } = await import(
    "@/lib/data/connector/ConnectorAgendaRepository"
  );
  return createConnectorAgendaRepository(ctx.tenantSlug).listMessaggiAgendaScoped(ctx);
}
