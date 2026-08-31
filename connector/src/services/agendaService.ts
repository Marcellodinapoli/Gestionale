import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";
import { bindPraticaScope, type HomeScopeFilter } from "./dashboardScope.js";
import { listImpegniAgenda } from "./impegniAgendaService.js";
import { listMessaggiInterni } from "./messaggiInterniService.js";

export type AgendaScopeRequest = {
  tenantId: string;
  role: string;
  userId: string;
  memberIds?: string[];
  scope: HomeScopeFilter;
};

export type AgendaCalendarioRequest = AgendaScopeRequest & {
  impegniUserId: string;
  take?: number;
};

export type AgendaGiornoRequest = AgendaScopeRequest & {
  impegniUserId: string;
  dayStart: string;
  dayEnd: string;
};

export type MemoAlertsRequest = AgendaScopeRequest & {
  impegniUserId: string;
  canAgenda: boolean;
  memoAtGte: string;
  memoAtLte: string;
  internTake?: number;
};

function mapPraticaRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    numero: String(r.Numero),
    memoAt: r.MemoAt ? new Date(String(r.MemoAt)).toISOString() : null,
    tipoContatto: r.TipoContatto != null ? String(r.TipoContatto) : null,
    esitoContatto: r.EsitoContatto != null ? String(r.EsitoContatto) : null,
    debitore: {
      nome: String(r.DebitoreNome ?? ""),
      cognome: String(r.DebitoreCognome ?? ""),
    },
    assegnatario: r.AssegnatarioName != null ? { name: String(r.AssegnatarioName) } : null,
    mandante: r.MandanteCodice != null ? { codice: String(r.MandanteCodice) } : undefined,
    telefono: r.DebitoreTelefono != null ? String(r.DebitoreTelefono) : null,
  };
}

async function queryPraticheMemo(
  cfg: ConnectorConfig["db"],
  input: AgendaScopeRequest & {
    memoAtGte?: string;
    memoAtLte?: string;
    memoAtNotNull?: boolean;
    take?: number;
    orderByMemoAt?: boolean;
  }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const scope = bindPraticaScope(req, { tenantId: input.tenantId, ...input.scope }, "p");
  const clauses = [scope.where];
  if (input.memoAtNotNull) clauses.push("p.MemoAt IS NOT NULL");
  if (input.memoAtGte) {
    req.input("memoAtGte", sql.DateTime2, new Date(input.memoAtGte));
    clauses.push("p.MemoAt >= @memoAtGte");
  }
  if (input.memoAtLte) {
    req.input("memoAtLte", sql.DateTime2, new Date(input.memoAtLte));
    clauses.push("p.MemoAt <= @memoAtLte");
  }
  const take = Math.min(input.take ?? 200, 200);
  req.input("take", sql.Int, take);

  const res = await req.query(`
    SELECT TOP (@take) p.Id, p.Numero, p.MemoAt, p.TipoContatto, p.EsitoContatto,
      d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome, d.Telefono AS DebitoreTelefono,
      m.Codice AS MandanteCodice, u.Name AS AssegnatarioName
    FROM dbo.Pratiche p
    INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
    INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
    LEFT JOIN dbo.Users u ON u.Id = p.AssegnatarioId
    ${scope.join}
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.MemoAt ${input.orderByMemoAt === false ? "DESC" : "ASC"}
  `);
  return res.recordset.map((r) => mapPraticaRow(r as Record<string, unknown>));
}

export async function loadAgendaCalendario(cfg: ConnectorConfig["db"], input: AgendaCalendarioRequest) {
  const [pratiche, impegni] = await Promise.all([
    queryPraticheMemo(cfg, { ...input, memoAtNotNull: true, take: input.take ?? 200 }),
    listImpegniAgenda(
      cfg,
      input.tenantId,
      { userId: input.impegniUserId, completato: false },
      input.take ?? 200
    ),
  ]);
  return { pratiche, impegni };
}

export async function loadAgendaGiorno(cfg: ConnectorConfig["db"], input: AgendaGiornoRequest) {
  const [pratiche, impegni] = await Promise.all([
    queryPraticheMemo(cfg, {
      ...input,
      memoAtGte: input.dayStart,
      memoAtLte: input.dayEnd,
      take: 100,
    }),
    listImpegniAgenda(
      cfg,
      input.tenantId,
      {
        userId: input.impegniUserId,
        completato: false,
        memoAtGte: input.dayStart,
        memoAtLte: input.dayEnd,
      },
      100
    ),
  ]);
  return { pratiche, impegni };
}

export async function loadMemoAlertsBundle(cfg: ConnectorConfig["db"], input: MemoAlertsRequest) {
  const pratiche = input.canAgenda
    ? await queryPraticheMemo(cfg, {
        ...input,
        memoAtGte: input.memoAtGte,
        memoAtLte: input.memoAtLte,
        take: 50,
      })
    : [];

  const impegni = input.canAgenda
    ? await listImpegniAgenda(
        cfg,
        input.tenantId,
        {
          userId: input.impegniUserId,
          completato: false,
          memoAtGte: input.memoAtGte,
          memoAtLte: input.memoAtLte,
        },
        50
      )
    : [];

  const intern = await listMessaggiInterni(
    cfg,
    input.tenantId,
    { toUserId: input.userId, letto: false },
    input.internTake ?? 30
  );

  return { pratiche, impegni, intern };
}

export async function listMessaggiAgendaScoped(
  cfg: ConnectorConfig["db"],
  input: AgendaScopeRequest & { take?: number }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const scope = bindPraticaScope(req, { tenantId: input.tenantId, ...input.scope }, "p");
  const take = Math.min(input.take ?? 100, 100);
  req.input("take", sql.Int, take);

  const res = await req.query(`
    SELECT TOP (@take) m.*, p.Numero, d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome,
      u.Name AS UserName
    FROM dbo.MessaggiAgenda m
    INNER JOIN dbo.Pratiche p ON p.Id = m.PraticaId
    INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
    INNER JOIN dbo.Users u ON u.Id = m.UserId
    ${scope.join}
    WHERE m.TenantId = @tenantId AND ${scope.where}
    ORDER BY m.CreatedAt DESC
  `);
  return res.recordset.map((r) => ({
    id: String(r.Id),
    praticaId: String(r.PraticaId),
    userId: String(r.UserId),
    memoAt: new Date(String(r.MemoAt)).toISOString(),
    line: String(r.Line),
    letto: Boolean(r.Letto),
    lettoAt: r.LettoAt ? new Date(String(r.LettoAt)).toISOString() : null,
    createdAt: new Date(String(r.CreatedAt)).toISOString(),
    pratica: {
      id: String(r.PraticaId),
      numero: String(r.Numero),
      debitore: { nome: String(r.DebitoreNome), cognome: String(r.DebitoreCognome) },
    },
    user: { id: String(r.UserId), name: String(r.UserName) },
  }));
}
