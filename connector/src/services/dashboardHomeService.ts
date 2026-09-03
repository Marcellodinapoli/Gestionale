import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";
import {
  bindPraticaScope,
  CODICE_SLOT_SQL,
  STATI_CHIUSI_SQL,
  type HomeScopeFilter,
} from "./dashboardScope.js";

export type HomeKpiRequest = {
  tenantId: string;
  role: string;
  userId: string;
  sedeScopeId?: string | null;
  lavorateDate: string;
  incMandante?: string;
  incPerimetro?: string;
  incMese?: string;
  scope: HomeScopeFilter;
  incassiScope: "none" | "tenant" | "user";
  includeAdmin: boolean;
  includeAmministrazione: boolean;
  vistaGruppoLavorate: boolean;
  gruppoMandanti?: Array<{ mandanteId: string; perimetriIds: string[] }>;
  memberIds?: string[];
  sedeRicaviId?: string | null;
  mostraRicavi?: boolean;
  includeProduttivita?: boolean;
};

function startOfDayIso(iso: string) {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function nextDayIso(iso: string) {
  const d = startOfDayIso(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const MESE_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function rangeMeseIncassiSql(incMese?: string) {
  const oggi = startOfDayIso(new Date().toISOString().slice(0, 10));
  let year = oggi.getUTCFullYear();
  let month = oggi.getUTCMonth();
  const match = incMese?.trim().match(MESE_RE);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]) - 1;
  }
  const inizioMese = new Date(Date.UTC(year, month, 1));
  const fineMese = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { inizioMese, fineMese };
}

const CODICI_SCARICO = ["PTC", "PPC", "MOV", "LPP", "LPT"] as const;
type CodiceScaricoSql = (typeof CODICI_SCARICO)[number];

const STATO_SCARICO: Record<string, CodiceScaricoSql> = {
  INCASSO: "PTC",
  PROMESSA: "PPC",
  INESIGIBILE: "MOV",
  PIANO: "LPP",
  RESA: "LPT",
};

function codiceDaAuditSql(
  action: string,
  dettaglio: string | null | undefined,
  statoCorrente?: string
): CodiceScaricoSql | null {
  if (action === "piano") return "LPP";
  if (action === "incasso") return statoCorrente === "INCASSO" ? "PTC" : null;
  if (action === "stato_update") return STATO_SCARICO[(dettaglio || "").trim()] ?? null;
  if (action === "scarico_update") {
    const codice = (dettaglio || "").trim().split(/\s+/)[0];
    return CODICI_SCARICO.includes(codice as CodiceScaricoSql) ? (codice as CodiceScaricoSql) : null;
  }
  if (action === "contatto_update") {
    const tokens = (dettaglio || "").trim().split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (CODICI_SCARICO.includes(t as CodiceScaricoSql)) return t as CodiceScaricoSql;
    }
  }
  return null;
}

function aggregaCodiciScaricoAdminSql(
  logs: Array<{
    entityId: string | null;
    action: string;
    dettaglio: string | null;
    createdAt: Date;
    stato?: string;
  }>,
  gteOggi: Date,
  ltOggi: Date
) {
  const perCodice = new Map<CodiceScaricoSql, { oggi: Set<string>; mese: Set<string> }>();
  for (const c of CODICI_SCARICO) perCodice.set(c, { oggi: new Set(), mese: new Set() });
  for (const log of logs) {
    const praticaId = log.entityId;
    if (!praticaId) continue;
    const codice = codiceDaAuditSql(log.action, log.dettaglio, log.stato);
    if (!codice) continue;
    const bucket = perCodice.get(codice)!;
    bucket.mese.add(praticaId);
    if (log.createdAt >= gteOggi && log.createdAt < ltOggi) bucket.oggi.add(praticaId);
  }
  return CODICI_SCARICO.map((codice) => ({
    codice,
    oggi: perCodice.get(codice)!.oggi.size,
    mese: perCodice.get(codice)!.mese.size,
  }));
}

function parsePerimetriNames(json: string | null | undefined): string[] {
  if (!json?.trim()) return [];
  try {
    const arr = JSON.parse(json) as Array<{ nomeMandante?: string }>;
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => p.nomeMandante?.trim()).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

function buildIncassiPerMandanteMese(
  rows: Array<{ yr: number; mo: number; Codice: string; importo: unknown }>,
  mandantiAttivi: Array<{ codice: string }>,
  mesiIndietro: number,
  oggi: Date
) {
  const sums = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.yr}-${r.mo}|${r.Codice}`;
    sums.set(key, (sums.get(key) || 0) + Number(r.importo));
  }
  const out: Array<{
    mese: string;
    mandanti: Array<{ codice: string; importo: number }>;
    totale: number;
  }> = [];
  for (let i = mesiIndietro - 1; i >= 0; i--) {
    const da = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - i, 1));
    const mandantiMese: Array<{ codice: string; importo: number }> = [];
    let totaleMese = 0;
    for (const m of mandantiAttivi) {
      const imp = sums.get(`${da.getUTCFullYear()}-${da.getUTCMonth()}|${m.codice}`) || 0;
      mandantiMese.push({ codice: m.codice, importo: imp });
      totaleMese += imp;
    }
    out.push({
      mese: da.toLocaleDateString("it-IT", { month: "short", year: "2-digit", timeZone: "UTC" }),
      mandanti: mandantiMese,
      totale: totaleMese,
    });
  }
  return out;
}

function codiceSlotExpr(alias = "p") {
  return CODICE_SLOT_SQL.replace(/\bp\./g, `${alias}.`);
}

export async function getHomeKpiBundle(cfg: ConnectorConfig["db"], req: HomeKpiRequest) {
  const pool = await getPool(cfg);
  const start = performance.now();
  let sqlQueries = 0;

  const scope: HomeScopeFilter = {
    ...(req.scope ?? { mode: "tenant" as const }),
    sedeId: req.sedeScopeId || req.scope?.sedeId,
  };

  const lavorateGte = startOfDayIso(req.lavorateDate);
  const lavorateLt = nextDayIso(req.lavorateDate);
  const oggiStart = startOfDayIso(new Date().toISOString().slice(0, 10));

  // --- Shared: counts (1 query) ---
  const countReq = pool.request();
  const scopeSql = bindPraticaScope(countReq, { ...scope, tenantId: req.tenantId }, "p");
  sqlQueries++;
  const countRes = await countReq.query(`
    SELECT
      COUNT(*) AS totali,
      SUM(CASE WHEN p.Scadenza IS NOT NULL AND p.Scadenza <= SYSUTCDATETIME()
        AND p.Stato NOT IN ${STATI_CHIUSI_SQL} THEN 1 ELSE 0 END) AS scadute
    FROM dbo.Pratiche p
    ${scopeSql.join}
    WHERE ${scopeSql.where}
  `);
  const totali = Number(countRes.recordset[0]?.totali ?? 0);
  const scadute = Number(countRes.recordset[0]?.scadute ?? 0);

  // --- Incassi oggi (1 query) ---
  let incassiOggiSum = 0;
  if (req.incassiScope !== "none") {
    const incReq = pool.request().input("tenantId", sql.UniqueIdentifier, req.tenantId);
    incReq.input("oggiStart", sql.DateTime2, oggiStart);
    const incClauses = ["i.TenantId = @tenantId", "i.Data >= @oggiStart"];
    if (req.incassiScope === "user") {
      incReq.input("userId", sql.UniqueIdentifier, req.userId);
      incClauses.push("i.UserId = @userId");
    }
    sqlQueries++;
    const incRes = await incReq.query(`
      SELECT ISNULL(SUM(i.Importo), 0) AS tot FROM dbo.Incassi i WHERE ${incClauses.join(" AND ")}
    `);
    incassiOggiSum = Number(incRes.recordset[0]?.tot ?? 0);
  }

  // --- In lavorazione per perimetro (1 query) ---
  const lavReq = pool.request();
  const lavScope = bindPraticaScope(lavReq, { ...scope, tenantId: req.tenantId }, "p");
  sqlQueries++;
  const lavRes = await lavReq.query(`
    SELECT p.MandanteId AS mandanteId, m.Codice AS mandanteCodice,
      ISNULL(NULLIF(LTRIM(RTRIM(p.NumeroMandante)), N''), N'—') AS perimetro,
      COUNT(*) AS cnt
    FROM dbo.Pratiche p
    INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
    ${lavScope.join}
    WHERE ${lavScope.where}
      AND p.Stato IN (N'AFFIDATA', N'IN_LAVORAZIONE', N'PROMESSA')
    GROUP BY p.MandanteId, m.Codice, ISNULL(NULLIF(LTRIM(RTRIM(p.NumeroMandante)), N''), N'—')
  `);
  const inLavoroPerPerimetro = lavRes.recordset.map(
    (r: { mandanteId: string; mandanteCodice: string; perimetro: string; cnt: number }) => ({
      mandanteId: String(r.mandanteId),
      mandanteCodice: r.mandanteCodice,
      perimetro: r.perimetro,
      count: Number(r.cnt),
    })
  );

  // --- Codici mandante perimetro (1 query) ---
  const codReq = pool.request();
  const codScope = bindPraticaScope(codReq, { ...scope, tenantId: req.tenantId }, "p");
  sqlQueries++;
  const codRes = await codReq.query(`
    SELECT p.MandanteId AS mandanteId, m.Codice AS mandanteCodice, m.RagioneSociale AS mandanteNome,
      ISNULL(NULLIF(LTRIM(RTRIM(p.NumeroMandante)), N''), N'—') AS perimetro,
      ${codiceSlotExpr("p")} AS codiceSlot,
      SUM(CASE WHEN p.AssegnatarioId IS NOT NULL THEN 1 ELSE 0 END) AS affidate,
      COUNT(*) AS cnt
    FROM dbo.Pratiche p
    INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
    ${codScope.join}
    WHERE ${codScope.where} AND p.Stato NOT IN ${STATI_CHIUSI_SQL}
    GROUP BY p.MandanteId, m.Codice, m.RagioneSociale,
      ISNULL(NULLIF(LTRIM(RTRIM(p.NumeroMandante)), N''), N'—'),
      ${codiceSlotExpr("p")}
  `);

  type CodRow = {
    mandanteId: string;
    mandanteCodice: string;
    mandanteNome: string;
    perimetro: string;
    codiceSlot: string;
    affidate: number;
    cnt: number;
  };
  const codMap = new Map<string, Record<string, unknown>>();
  for (const r of codRes.recordset as CodRow[]) {
    const key = `${r.mandanteId}|${r.perimetro}`;
    let row = codMap.get(key) as Record<string, unknown> | undefined;
    if (!row) {
      row = {
        mandanteId: String(r.mandanteId),
        mandanteCodice: r.mandanteCodice,
        mandanteNome: r.mandanteNome,
        perimetro: r.perimetro,
        affidate: 0,
        conteggi: { PTC: 0, PPC: 0, MOV: 0, LPP: 0, LPT: 0, ND: 0 },
        totale: 0,
      };
      codMap.set(key, row);
    }
    const slot = r.codiceSlot as keyof typeof row.conteggi;
    const conteggi = row.conteggi as Record<string, number>;
    conteggi[slot] = (conteggi[slot] || 0) + Number(r.cnt);
    row.affidate = Number(row.affidate) + Number(r.affidate);
    row.totale = Number(row.totale) + Number(r.cnt);
  }
  const codiciMandantePerimetro = [...codMap.values()];

  // --- Da affidare gruppo (1 query, optional) ---
  let daAffidareGruppo: Array<Record<string, unknown>> = [];
  if (req.gruppoMandanti?.length) {
    const affReq = pool.request();
    affReq.input("tenantId", sql.UniqueIdentifier, req.tenantId);
    const orParts: string[] = [];
    req.gruppoMandanti.forEach((g, i) => {
      affReq.input(`gm${i}`, sql.UniqueIdentifier, g.mandanteId);
      orParts.push(`p.MandanteId = @gm${i}`);
    });
    sqlQueries++;
    const affRes = await affReq.query(`
      SELECT p.MandanteId AS mandanteId, m.Codice AS mandanteCodice,
        ISNULL(NULLIF(LTRIM(RTRIM(p.NumeroMandante)), N''), N'—') AS perimetro,
        COUNT(*) AS cnt
      FROM dbo.Pratiche p
      INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
      WHERE p.TenantId = @tenantId AND p.AssegnatarioId IS NULL
        AND p.Stato NOT IN ${STATI_CHIUSI_SQL}
        AND (${orParts.join(" OR ")})
      GROUP BY p.MandanteId, m.Codice, ISNULL(NULLIF(LTRIM(RTRIM(p.NumeroMandante)), N''), N'—')
    `);
    daAffidareGruppo = affRes.recordset.map(
      (r: { mandanteId: string; mandanteCodice: string; perimetro: string; cnt: number }) => ({
        mandanteId: String(r.mandanteId),
        mandanteCodice: r.mandanteCodice,
        perimetro: r.perimetro,
        count: Number(r.cnt),
      })
    );
  }

  // --- Lavorate giorno (1 query) ---
  const lavGiornoReq = pool.request();
  lavGiornoReq.input("gte", sql.DateTime2, lavorateGte);
  lavGiornoReq.input("lt", sql.DateTime2, lavorateLt);
  const lavGScope = bindPraticaScope(lavGiornoReq, { ...scope, tenantId: req.tenantId }, "p");
  sqlQueries++;
  const lavGiornoRes = await lavGiornoReq.query(`
    WITH ranked AS (
      SELECT a.PraticaId, a.UserId, u.Name AS UserName,
        ROW_NUMBER() OVER (PARTITION BY a.PraticaId ORDER BY a.CreatedAt DESC) AS rn
      FROM dbo.Attivita a
      INNER JOIN dbo.Users u ON u.Id = a.UserId
      INNER JOIN dbo.Pratiche p ON p.Id = a.PraticaId
      ${lavGScope.join}
      WHERE a.TenantId = @tenantId
        AND a.CreatedAt >= @gte AND a.CreatedAt < @lt
        AND u.Role IN (N'OPERATOR', N'OPERATORE', N'SUPERVISOR')
        AND ${lavGScope.where.replace(/\bp\./g, "p.")}
    )
    SELECT PraticaId AS praticaId, UserId AS userId, UserName AS name
    FROM ranked WHERE rn = 1
  `);

  const praticheLavorateItems = lavGiornoRes.recordset.map(
    (r: { praticaId: string; userId: string; name: string }) => ({
      praticaId: String(r.praticaId),
      userId: String(r.userId),
      name: r.name,
      sigla: r.name
        .split(/\s+/)
        .map((w: string) => w[0])
        .join("")
        .slice(0, 3)
        .toUpperCase(),
    })
  );

  const byOp = new Map<string, { userId: string; name: string; sigla: string; count: number; cambiCodice: number }>();
  for (const item of praticheLavorateItems) {
    const row = byOp.get(item.userId);
    if (row) row.count += 1;
    else byOp.set(item.userId, { ...item, count: 1, cambiCodice: 0 });
  }
  const lavoratePerOperatore = [...byOp.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "it")
  );

  const praticheLavorateGruppo = req.vistaGruppoLavorate ? praticheLavorateItems : [];

  // Cambio codice: simplified — audit logs giorno (1 query)
  let praticheCambioCodice: Array<Record<string, unknown>> = [];
  if (scope.mode !== "none") {
    const auditReq = pool.request();
    auditReq.input("gte", sql.DateTime2, lavorateGte);
    auditReq.input("lt", sql.DateTime2, lavorateLt);
    const audScope = bindPraticaScope(auditReq, { ...scope, tenantId: req.tenantId }, "p");
    sqlQueries++;
    try {
      const auditRes = await auditReq.query(`
        SELECT TOP 200 a.EntityId AS praticaId, p.Numero AS numero,
          d.Cognome + N' ' + d.Nome AS debitore, a.Action AS action, a.Dettaglio AS dettaglio, a.UserId AS userId
        FROM dbo.AuditLog a
        INNER JOIN dbo.Pratiche p ON p.Id = a.EntityId
        INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
        ${audScope.join}
        WHERE a.TenantId = @tenantId AND a.Entity = N'pratica'
          AND a.CreatedAt >= @gte AND a.CreatedAt < @lt
          AND a.Action IN (N'stato_update', N'piano', N'incasso', N'contatto_update', N'scarico_update')
          AND ${audScope.where.replace(/\bp\./g, "p.")}
      `);
      praticheCambioCodice = auditRes.recordset.map(
        (r: { praticaId: string; numero: string; debitore: string; dettaglio: string; userId: string }) => ({
          praticaId: String(r.praticaId),
          numero: r.numero,
          debitore: r.debitore?.trim() || "",
          da: "—",
          a: (r.dettaglio || "").trim().slice(0, 80) || "—",
          userId: r.userId ? String(r.userId) : null,
        })
      );
    } catch {
      praticheCambioCodice = [];
    }
  }

  const shared = {
    totali,
    scadute,
    incassiOggiSum,
    inLavoroPerPerimetro,
    lavoratePerOperatore,
    praticheLavorateGruppo,
    praticheCambioCodice,
    codiciMandantePerimetro,
    daAffidareGruppo,
  };

  let admin: Record<string, unknown> | undefined;
  let amministrazione: Record<string, unknown> | undefined;

  if (req.includeAdmin) {
    admin = await loadAdminSection(pool, req, () => {
      sqlQueries += 1;
    });
  }

  if (req.includeAmministrazione) {
    amministrazione = await loadAmministrazioneSection(pool, req, () => {
      sqlQueries += 1;
    });
  }

  return {
    shared,
    admin,
    amministrazione,
    meta: {
      queryMs: Math.round(performance.now() - start),
      sqlQueries,
      roundTrips: 1,
    },
  };
}

async function loadAdminSection(
  pool: Awaited<ReturnType<typeof getPool>>,
  req: HomeKpiRequest,
  tick: () => void
) {
  const sedeId = req.sedeScopeId || undefined;
  const tenantId = req.tenantId;
  const oggi = startOfDayIso(new Date().toISOString().slice(0, 10));
  const { inizioMese, fineMese } = rangeMeseIncassiSql(req.incMese);
  const tra7gg = new Date(oggi);
  tra7gg.setUTCDate(tra7gg.getUTCDate() + 7);

  tick();
  const sediRes = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .query(`SELECT Id, Nome FROM dbo.Sedi WHERE TenantId = @tenantId AND Active = 1 ORDER BY Nome`);

  tick();
  const sedeJoin = sedeId
    ? `LEFT JOIN dbo.Users ua ON ua.Id = p.AssegnatarioId LEFT JOIN dbo.Users ut ON ut.Id = p.OperatoreTitolareId`
    : "";
  const sedeClause = sedeId
    ? ` AND (ua.SedeId = @sedeId OR ut.SedeId = @sedeId)`
    : "";

  const riepReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  if (sedeId) riepReq.input("sedeId", sql.UniqueIdentifier, sedeId);
  tick();
  const ricavoLordoExpr = sedeId
    ? `(SELECT ISNULL(SUM(pv.Importo), 0)
        FROM dbo.Provvigioni pv
        INNER JOIN dbo.Pratiche px ON px.Id = pv.PraticaId
        LEFT JOIN dbo.Users uap ON uap.Id = px.AssegnatarioId
        LEFT JOIN dbo.Users utp ON utp.Id = px.OperatoreTitolareId
        WHERE px.MandanteId = m.Id AND px.TenantId = @tenantId
          AND (uap.SedeId = @sedeId OR utp.SedeId = @sedeId))`
    : `(SELECT ISNULL(SUM(pv.Importo), 0)
        FROM dbo.Provvigioni pv
        INNER JOIN dbo.Pratiche px ON px.Id = pv.PraticaId
        WHERE px.MandanteId = m.Id AND px.TenantId = @tenantId)`;

  const riepRes = await riepReq.query(`
    SELECT m.Id, m.Codice, m.RagioneSociale,
      COUNT(p.Id) AS pratiche,
      ISNULL(SUM(p.ImportoTotale), 0) AS affidato,
      ISNULL(SUM(p.TotIncassato), 0) AS incassato,
      ${ricavoLordoExpr} AS ricavoLordo
    FROM dbo.Mandanti m
    LEFT JOIN dbo.Pratiche p ON p.MandanteId = m.Id AND p.TenantId = @tenantId
    ${sedeJoin}
    WHERE m.TenantId = @tenantId ${sedeClause}
    GROUP BY m.Id, m.Codice, m.RagioneSociale
    ORDER BY m.Codice
  `);

  const mandantiRiepilogo = riepRes.recordset.map(
    (r: {
      Id: string;
      Codice: string;
      RagioneSociale: string;
      pratiche: number;
      affidato: unknown;
      incassato: unknown;
      ricavoLordo: unknown;
    }) => {
      const affidato = Number(r.affidato);
      const incassato = Number(r.incassato);
      return {
        id: String(r.Id),
        codice: r.Codice,
        ragioneSociale: r.RagioneSociale,
        pratiche: Number(r.pratiche),
        affidato,
        incassato,
        ricavoLordo: Number(r.ricavoLordo),
        percentuale: affidato > 0 ? (incassato / affidato) * 100 : 0,
      };
    }
  );

  tick();
  const mandantiRes = await pool.request().input("tenantId", sql.UniqueIdentifier, tenantId).query(`
    SELECT Id, Codice, RagioneSociale, PerimetriJson FROM dbo.Mandanti WHERE TenantId = @tenantId ORDER BY Codice
  `);

  tick();
  const lottiReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  const lottiRes = await lottiReq.query(`
    SELECT MandanteId, NumeroMandante FROM dbo.Pratiche
    WHERE TenantId = @tenantId AND NumeroMandante IS NOT NULL
    GROUP BY MandanteId, NumeroMandante
  `);

  tick();
  const incFilterReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  let incJoin = "INNER JOIN dbo.Pratiche p ON p.Id = i.PraticaId";
  const incClauses = ["i.TenantId = @tenantId"];
  if (req.incMandante) {
    incFilterReq.input("mandanteId", sql.UniqueIdentifier, req.incMandante);
    incClauses.push("p.MandanteId = @mandanteId");
  }
  if (req.incPerimetro) {
    incFilterReq.input("numeroMandante", sql.NVarChar(100), req.incPerimetro);
    incClauses.push("p.NumeroMandante = @numeroMandante");
  }
  if (sedeId) {
    incFilterReq.input("sedeId", sql.UniqueIdentifier, sedeId);
    incJoin += ` LEFT JOIN dbo.Users ua ON ua.Id = p.AssegnatarioId LEFT JOIN dbo.Users ut ON ut.Id = p.OperatoreTitolareId`;
    incClauses.push("(ua.SedeId = @sedeId OR ut.SedeId = @sedeId)");
  }
  incFilterReq.input("inizioMese", sql.DateTime2, inizioMese);
  incFilterReq.input("fineMese", sql.DateTime2, fineMese);
  const incRes = await incFilterReq.query(`
    SELECT i.Metodo AS metodo,
      SUM(i.Importo) AS importo,
      COUNT(*) AS pezzi,
      SUM(CASE WHEN i.Data >= @inizioMese AND i.Data <= @fineMese THEN i.Importo ELSE 0 END) AS meseImporto,
      SUM(CASE WHEN i.Data >= @inizioMese AND i.Data <= @fineMese THEN 1 ELSE 0 END) AS mesePezzi
    FROM dbo.Incassi i
    ${incJoin}
    WHERE ${incClauses.join(" AND ")}
    GROUP BY i.Metodo
  `);

  tick();
  const inizioOggi = oggi;
  const fineOggi = new Date(oggi);
  fineOggi.setUTCHours(23, 59, 59, 999);
  const ltOggi = new Date(oggi);
  ltOggi.setUTCDate(ltOggi.getUTCDate() + 1);

  let produttivita: Array<{ name: string; oggi: number; mese: number }> | undefined;
  if (req.includeProduttivita) {
    const prodReq = pool.request();
    prodReq.input("tenantId", sql.UniqueIdentifier, tenantId);
    prodReq.input("gteOggi", sql.DateTime2, inizioOggi);
    prodReq.input("lteOggi", sql.DateTime2, fineOggi);
    prodReq.input("gteMese", sql.DateTime2, inizioMese);
    prodReq.input("lteMese", sql.DateTime2, fineMese);
    if (sedeId) prodReq.input("sedeId", sql.UniqueIdentifier, sedeId);
    if (req.incMandante) {
      prodReq.input("mandanteId", sql.UniqueIdentifier, req.incMandante);
    }
    if (req.incPerimetro) {
      prodReq.input("numeroMandante", sql.NVarChar(100), req.incPerimetro);
    }

    const praticaJoinClauses = ["p.TenantId = @tenantId"];
    if (req.incMandante) praticaJoinClauses.push("p.MandanteId = @mandanteId");
    if (req.incPerimetro) praticaJoinClauses.push("p.NumeroMandante = @numeroMandante");
    const praticaSedeJoin = sedeId
      ? `LEFT JOIN dbo.Users uap ON uap.Id = p.AssegnatarioId LEFT JOIN dbo.Users utp ON utp.Id = p.OperatoreTitolareId`
      : "";
    const praticaSedeClause = sedeId
      ? " AND (uap.SedeId = @sedeId OR utp.SedeId = @sedeId)"
      : "";

    const prodRes = await prodReq.query(`
      SELECT u.Id, u.Name,
        COUNT(CASE WHEN p.Id IS NOT NULL AND a.CreatedAt >= @gteOggi AND a.CreatedAt <= @lteOggi THEN a.Id END) AS oggi,
        COUNT(CASE WHEN p.Id IS NOT NULL AND a.CreatedAt >= @gteMese AND a.CreatedAt <= @lteMese THEN a.Id END) AS mese
      FROM dbo.Users u
      LEFT JOIN dbo.Attivita a ON a.UserId = u.Id
      LEFT JOIN dbo.Pratiche p ON p.Id = a.PraticaId AND ${praticaJoinClauses.join(" AND ")}
      ${praticaSedeJoin}
      WHERE u.TenantId = @tenantId AND u.Active = 1 AND u.Role IN (N'OPERATOR', N'OPERATORE', N'SUPERVISOR')
      ${sedeId ? "AND u.SedeId = @sedeId" : ""}
      ${praticaSedeClause}
      GROUP BY u.Id, u.Name
      ORDER BY u.Name
    `);
    produttivita = prodRes.recordset.map((r: { Name: string; oggi: number; mese: number }) => ({
      name: r.Name,
      oggi: Number(r.oggi),
      mese: Number(r.mese),
    }));
  }

  tick();
  const alertReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  alertReq.input("oggi", sql.DateTime2, oggi);
  alertReq.input("tra7", sql.DateTime2, tra7gg);
  if (sedeId) alertReq.input("sedeId", sql.UniqueIdentifier, sedeId);
  const alertRes = await alertReq.query(`
    SELECT
      SUM(CASE WHEN p.Stato = N'NUOVA' THEN 1 ELSE 0 END) AS nuove,
      SUM(CASE WHEN p.Stato = N'IN_LAVORAZIONE' THEN 1 ELSE 0 END) AS inLavorazione,
      SUM(CASE WHEN p.Scadenza >= @oggi AND p.Scadenza <= @tra7 AND p.Stato NOT IN ${STATI_CHIUSI_SQL} THEN 1 ELSE 0 END) AS inScadenza7gg,
      SUM(CASE WHEN p.AssegnatarioId IS NULL AND p.Stato NOT IN ${STATI_CHIUSI_SQL} THEN 1 ELSE 0 END) AS nonAssegnate
    FROM dbo.Pratiche p
    ${sedeJoin}
    WHERE p.TenantId = @tenantId ${sedeClause}
  `);

  tick();
  const opCountReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  if (sedeId) opCountReq.input("sedeId", sql.UniqueIdentifier, sedeId);
  const opCountRes = await opCountReq.query(`
    SELECT COUNT(*) AS cnt FROM dbo.Users
    WHERE TenantId = @tenantId AND Active = 1 AND Role IN (N'OPERATOR', N'OPERATORE', N'SUPERVISOR')
    ${sedeId ? "AND SedeId = @sedeId" : ""}
  `);

  const lottiMap = new Map<string, Set<string>>();
  for (const row of lottiRes.recordset as Array<{ MandanteId: string; NumeroMandante: string | null }>) {
    const lotto = row.NumeroMandante?.trim();
    if (!lotto) continue;
    const set = lottiMap.get(String(row.MandanteId)) ?? new Set<string>();
    set.add(lotto);
    lottiMap.set(String(row.MandanteId), set);
  }

  const mandantiAttivi = mandantiRes.recordset.map((m: { Id: string; Codice: string }) => ({
    id: String(m.Id),
    codice: m.Codice,
  }));

  const mandantiFiltriUi = mandantiRes.recordset.map(
    (m: { Id: string; Codice: string; RagioneSociale: string; PerimetriJson: string | null }) => {
      const fromConfig = parsePerimetriNames(m.PerimetriJson);
      const fromPratiche = [...(lottiMap.get(String(m.Id)) ?? [])];
      const perimetri = [...new Set([...fromConfig, ...fromPratiche])].sort((a, b) =>
        a.localeCompare(b, "it")
      );
      return {
        id: String(m.Id),
        codice: m.Codice,
        ragioneSociale: m.RagioneSociale,
        perimetri,
      };
    }
  );

  tick();
  const caricoReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  if (sedeId) caricoReq.input("sedeId", sql.UniqueIdentifier, sedeId);
  const caricoRes = await caricoReq.query(`
    WITH sup AS (
      SELECT Id, Name, GruppoNome FROM dbo.Users
      WHERE TenantId = @tenantId AND Role = N'SUPERVISOR' AND Active = 1
      ${sedeId ? "AND SedeId = @sedeId" : ""}
    ),
    team AS (
      SELECT s.Id AS supId, s.GruppoNome, s.Name AS supName, s.Id AS memberId FROM sup s
      UNION ALL
      SELECT s.Id, s.GruppoNome, s.Name, u.Id
      FROM sup s
      INNER JOIN dbo.Users u ON u.SupervisorId = s.Id AND u.TenantId = @tenantId AND u.Active = 1
      ${sedeId ? "AND u.SedeId = @sedeId" : ""}
    )
    SELECT t.supId,
      MAX(ISNULL(NULLIF(LTRIM(RTRIM(t.GruppoNome)), N''), t.supName)) AS nome,
      COUNT(DISTINCT t.memberId) AS membri,
      SUM(CASE WHEN p.Id IS NOT NULL AND p.Stato NOT IN ${STATI_CHIUSI_SQL} THEN 1 ELSE 0 END) AS aperte,
      COUNT(p.Id) AS totali
    FROM team t
    LEFT JOIN dbo.Pratiche p ON p.AssegnatarioId = t.memberId AND p.TenantId = @tenantId
    ${sedeId ? "LEFT JOIN dbo.Users ua ON ua.Id = p.AssegnatarioId LEFT JOIN dbo.Users ut ON ut.Id = p.OperatoreTitolareId" : ""}
    WHERE 1=1
    ${sedeId ? "AND (p.Id IS NULL OR ua.SedeId = @sedeId OR ut.SedeId = @sedeId)" : ""}
    GROUP BY t.supId
    ORDER BY nome
  `);

  tick();
  const scaricoReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  scaricoReq.input("inizioMese", sql.DateTime2, inizioMese);
  scaricoReq.input("fineMese", sql.DateTime2, fineMese);
  scaricoReq.input("gteOggi", sql.DateTime2, inizioOggi);
  scaricoReq.input("ltOggi", sql.DateTime2, fineOggi);
  let scaricoJoin = "INNER JOIN dbo.Pratiche p ON p.Id = a.EntityId";
  const scaricoClauses = [
    "a.TenantId = @tenantId",
    "a.Entity = N'pratica'",
    "a.CreatedAt >= @inizioMese",
    "a.CreatedAt <= @fineMese",
    "a.Action IN (N'stato_update', N'piano', N'incasso', N'contatto_update', N'scarico_update')",
  ];
  if (req.incMandante) {
    scaricoReq.input("mandanteId", sql.UniqueIdentifier, req.incMandante);
    scaricoClauses.push("p.MandanteId = @mandanteId");
  }
  if (req.incPerimetro) {
    scaricoReq.input("numeroMandante", sql.NVarChar(100), req.incPerimetro);
    scaricoClauses.push("p.NumeroMandante = @numeroMandante");
  }
  if (sedeId) {
    scaricoReq.input("sedeId", sql.UniqueIdentifier, sedeId);
    scaricoJoin += ` LEFT JOIN dbo.Users ua ON ua.Id = p.AssegnatarioId LEFT JOIN dbo.Users ut ON ut.Id = p.OperatoreTitolareId`;
    scaricoClauses.push("(ua.SedeId = @sedeId OR ut.SedeId = @sedeId)");
  }
  const scaricoRes = await scaricoReq.query(`
    SELECT a.EntityId AS entityId, a.Action AS action, a.Dettaglio AS dettaglio, a.CreatedAt AS createdAt, p.Stato AS stato
    FROM dbo.AuditLog a
    ${scaricoJoin}
    WHERE ${scaricoClauses.join(" AND ")}
  `);
  const codiciScaricoRiepilogo = aggregaCodiciScaricoAdminSql(
    scaricoRes.recordset as Array<{
      entityId: string | null;
      action: string;
      dettaglio: string | null;
      createdAt: Date;
      stato?: string;
    }>,
    inizioOggi,
    ltOggi
  );

  tick();
  const esitiReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  if (sedeId) esitiReq.input("sedeId", sql.UniqueIdentifier, sedeId);
  const esitiRes = await esitiReq.query(`
    SELECT p.EsitoContatto AS esitoContatto, COUNT(*) AS cnt
    FROM dbo.Pratiche p
    ${sedeJoin}
    WHERE p.TenantId = @tenantId AND p.EsitoContatto IS NOT NULL ${sedeClause}
    GROUP BY p.EsitoContatto
  `);

  const mesiIndietro = 6;
  const daIncassi = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - (mesiIndietro - 1), 1));
  const aIncassi = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  tick();
  const incMeseReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  incMeseReq.input("daIncassi", sql.DateTime2, daIncassi);
  incMeseReq.input("aIncassi", sql.DateTime2, aIncassi);
  if (sedeId) incMeseReq.input("sedeId", sql.UniqueIdentifier, sedeId);
  const incMeseRes = await incMeseReq.query(`
    SELECT YEAR(i.Data) AS yr, MONTH(i.Data) AS mo, m.Codice, SUM(i.Importo) AS importo
    FROM dbo.Incassi i
    INNER JOIN dbo.Pratiche p ON p.Id = i.PraticaId
    INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
    ${sedeId ? "LEFT JOIN dbo.Users ua ON ua.Id = p.AssegnatarioId LEFT JOIN dbo.Users ut ON ut.Id = p.OperatoreTitolareId" : ""}
    WHERE i.TenantId = @tenantId AND i.Data >= @daIncassi AND i.Data <= @aIncassi
    ${sedeId ? "AND (ua.SedeId = @sedeId OR ut.SedeId = @sedeId)" : ""}
    GROUP BY YEAR(i.Data), MONTH(i.Data), m.Codice
  `);

  const incassiPerMandanteMese = buildIncassiPerMandanteMese(
    incMeseRes.recordset as Array<{ yr: number; mo: number; Codice: string; importo: unknown }>,
    mandantiAttivi,
    mesiIndietro,
    oggi
  );

  return {
    sediOpts: sediRes.recordset.map((s: { Id: string; Nome: string }) => ({
      id: String(s.Id),
      nome: s.Nome,
    })),
    operatoriCount: Number(opCountRes.recordset[0]?.cnt ?? 0),
    mandantiRiepilogo,
    mandantiFiltriUi,
    tipologieIncasso: incRes.recordset.map(
      (r: { metodo: string; importo: unknown; pezzi: number; meseImporto: unknown; mesePezzi: number }) => ({
        metodo: r.metodo,
        pezzi: Number(r.pezzi),
        importo: Number(r.importo),
        meseImporto: Number(r.meseImporto),
        mesePezzi: Number(r.mesePezzi),
      })
    ),
    produttivita,
    caricoGruppi: caricoRes.recordset.map(
      (r: { nome: string; aperte: number; totali: number; membri: number }) => ({
        nome: r.nome,
        aperte: Number(r.aperte),
        totali: Number(r.totali),
        membri: Number(r.membri),
      })
    ),
    codiciScaricoRiepilogo,
    esitiContatto: esitiRes.recordset.map((r: { esitoContatto: string; cnt: number }) => ({
      esitoContatto: r.esitoContatto,
      count: Number(r.cnt),
    })),
    nuove: Number(alertRes.recordset[0]?.nuove ?? 0),
    inLavorazione: Number(alertRes.recordset[0]?.inLavorazione ?? 0),
    inScadenza7gg: Number(alertRes.recordset[0]?.inScadenza7gg ?? 0),
    nonAssegnate: Number(alertRes.recordset[0]?.nonAssegnate ?? 0),
    incassiPerMandanteMese,
    mandantiAttivi,
  };
}

async function loadAmministrazioneSection(
  pool: Awaited<ReturnType<typeof getPool>>,
  req: HomeKpiRequest,
  tick: () => void
) {
  const tenantId = req.tenantId;
  const sedeOps = req.sedeScopeId || undefined;
  const sedeRicavi = req.sedeRicaviId || undefined;
  const mostraRicavi = Boolean(req.mostraRicavi && sedeRicavi);
  const oggi = startOfDayIso(new Date().toISOString().slice(0, 10));
  const inizioMese = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), 1));

  tick();
  const sediRes = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .query(`SELECT Id, Nome FROM dbo.Sedi WHERE TenantId = @tenantId AND Active = 1 ORDER BY Nome`);

  tick();
  const praticheReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  let praticheClause = "TenantId = @tenantId";
  if (sedeOps) {
    praticheReq.input("sedeId", sql.UniqueIdentifier, sedeOps);
    praticheClause += ` AND (EXISTS (SELECT 1 FROM dbo.Users u WHERE u.Id = AssegnatarioId AND u.SedeId = @sedeId)
      OR EXISTS (SELECT 1 FROM dbo.Users u WHERE u.Id = OperatoreTitolareId AND u.SedeId = @sedeId))`;
  }
  const praticheRes = await praticheReq.query(`SELECT COUNT(*) AS cnt FROM dbo.Pratiche WHERE ${praticheClause}`);

  tick();
  const mandantiRes = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .query(`SELECT COUNT(*) AS cnt FROM dbo.Mandanti WHERE TenantId = @tenantId`);

  tick();
  const opReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  if (sedeOps) opReq.input("sedeId", sql.UniqueIdentifier, sedeOps);
  const opRes = await opReq.query(`
    SELECT COUNT(*) AS cnt FROM dbo.Users
    WHERE TenantId = @tenantId AND Active = 1 AND Role IN (N'OPERATOR', N'OPERATORE', N'SUPERVISOR')
    ${sedeOps ? "AND SedeId = @sedeId" : ""}
  `);

  let provvigioniMeseSum: number | null = null;
  let provvigioniDaLiquidareSum: number | null = null;
  if (mostraRicavi && sedeRicavi) {
    tick();
    const provMeseReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    provMeseReq.input("inizioMese", sql.DateTime2, inizioMese);
    provMeseReq.input("sedeRicavi", sql.UniqueIdentifier, sedeRicavi);
    const provMeseRes = await provMeseReq.query(`
      SELECT ISNULL(SUM(pv.Importo), 0) AS tot
      FROM dbo.Provvigioni pv
      INNER JOIN dbo.Users u ON u.Id = pv.OperatoreId
      WHERE pv.TenantId = @tenantId AND pv.CreatedAt >= @inizioMese AND u.SedeId = @sedeRicavi
    `);
    provvigioniMeseSum = Number(provMeseRes.recordset[0]?.tot ?? 0);

    tick();
    const provLiqReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    provLiqReq.input("sedeRicavi", sql.UniqueIdentifier, sedeRicavi);
    const provLiqRes = await provLiqReq.query(`
      SELECT ISNULL(SUM(pv.Importo), 0) AS tot
      FROM dbo.Provvigioni pv
      INNER JOIN dbo.Users u ON u.Id = pv.OperatoreId
      WHERE pv.TenantId = @tenantId AND pv.Stato = N'MATURATA' AND u.SedeId = @sedeRicavi
    `);
    provvigioniDaLiquidareSum = Number(provLiqRes.recordset[0]?.tot ?? 0);
  }

  return {
    sediOpts: sediRes.recordset.map((s: { Id: string; Nome: string }) => ({
      id: String(s.Id),
      nome: s.Nome,
    })),
    totPratiche: Number(praticheRes.recordset[0]?.cnt ?? 0),
    provvigioniMeseSum,
    provvigioniDaLiquidareSum,
    mandantiCount: Number(mandantiRes.recordset[0]?.cnt ?? 0),
    operatoriCount: Number(opRes.recordset[0]?.cnt ?? 0),
    mostraRicavi,
    sedeFiltro: sedeOps ?? null,
  };
}
