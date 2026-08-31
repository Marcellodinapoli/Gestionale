import { sql, getPool } from "../db/pool.js";
import { bindPraticaScope, CODICE_SLOT_SQL, STATI_CHIUSI_SQL, } from "./dashboardScope.js";
function startOfDayIso(iso) {
    const d = new Date(iso);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
function nextDayIso(iso) {
    const d = startOfDayIso(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
}
function parsePerimetriNames(json) {
    if (!json?.trim())
        return [];
    try {
        const arr = JSON.parse(json);
        if (!Array.isArray(arr))
            return [];
        return arr.map((p) => p.nomeMandante?.trim()).filter(Boolean);
    }
    catch {
        return [];
    }
}
function buildIncassiPerMandanteMese(rows, mandantiAttivi, mesiIndietro, oggi) {
    const sums = new Map();
    for (const r of rows) {
        const key = `${r.yr}-${r.mo}|${r.Codice}`;
        sums.set(key, (sums.get(key) || 0) + Number(r.importo));
    }
    const out = [];
    for (let i = mesiIndietro - 1; i >= 0; i--) {
        const da = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - i, 1));
        const mandantiMese = [];
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
export async function getHomeKpiBundle(cfg, req) {
    const pool = await getPool(cfg);
    const start = performance.now();
    let sqlQueries = 0;
    const scope = {
        ...req.scope,
        sedeId: req.sedeScopeId || req.scope.sedeId,
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
    const inLavoroPerPerimetro = lavRes.recordset.map((r) => ({
        mandanteId: String(r.mandanteId),
        mandanteCodice: r.mandanteCodice,
        perimetro: r.perimetro,
        count: Number(r.cnt),
    }));
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
    const codMap = new Map();
    for (const r of codRes.recordset) {
        const key = `${r.mandanteId}|${r.perimetro}`;
        let row = codMap.get(key);
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
        const slot = r.codiceSlot;
        const conteggi = row.conteggi;
        conteggi[slot] = (conteggi[slot] || 0) + Number(r.cnt);
        row.affidate = Number(row.affidate) + Number(r.affidate);
        row.totale = Number(row.totale) + Number(r.cnt);
    }
    const codiciMandantePerimetro = [...codMap.values()];
    // --- Da affidare gruppo (1 query, optional) ---
    let daAffidareGruppo = [];
    if (req.gruppoMandanti?.length) {
        const affReq = pool.request();
        affReq.input("tenantId", sql.UniqueIdentifier, req.tenantId);
        const orParts = [];
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
        daAffidareGruppo = affRes.recordset.map((r) => ({
            mandanteId: String(r.mandanteId),
            mandanteCodice: r.mandanteCodice,
            perimetro: r.perimetro,
            count: Number(r.cnt),
        }));
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
    const praticheLavorateItems = lavGiornoRes.recordset.map((r) => ({
        praticaId: String(r.praticaId),
        userId: String(r.userId),
        name: r.name,
        sigla: r.name
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 3)
            .toUpperCase(),
    }));
    const byOp = new Map();
    for (const item of praticheLavorateItems) {
        const row = byOp.get(item.userId);
        if (row)
            row.count += 1;
        else
            byOp.set(item.userId, { ...item, count: 1, cambiCodice: 0 });
    }
    const lavoratePerOperatore = [...byOp.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"));
    const praticheLavorateGruppo = req.vistaGruppoLavorate ? praticheLavorateItems : [];
    // Cambio codice: simplified — audit logs giorno (1 query)
    let praticheCambioCodice = [];
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
            praticheCambioCodice = auditRes.recordset.map((r) => ({
                praticaId: String(r.praticaId),
                numero: r.numero,
                debitore: r.debitore?.trim() || "",
                da: "—",
                a: (r.dettaglio || "").trim().slice(0, 80) || "—",
                userId: r.userId ? String(r.userId) : null,
            }));
        }
        catch {
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
    let admin;
    let amministrazione;
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
async function loadAdminSection(pool, req, tick) {
    const sedeId = req.sedeScopeId || undefined;
    const tenantId = req.tenantId;
    const oggi = startOfDayIso(new Date().toISOString().slice(0, 10));
    const inizioMese = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), 1));
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
    if (sedeId)
        riepReq.input("sedeId", sql.UniqueIdentifier, sedeId);
    tick();
    const riepRes = await riepReq.query(`
    SELECT m.Id, m.Codice, m.RagioneSociale,
      COUNT(p.Id) AS pratiche,
      ISNULL(SUM(p.ImportoTotale), 0) AS affidato,
      ISNULL(SUM(p.TotIncassato), 0) AS incassato
    FROM dbo.Mandanti m
    LEFT JOIN dbo.Pratiche p ON p.MandanteId = m.Id AND p.TenantId = @tenantId
    ${sedeJoin}
    WHERE m.TenantId = @tenantId ${sedeClause}
    GROUP BY m.Id, m.Codice, m.RagioneSociale
    ORDER BY m.Codice
  `);
    const mandantiRiepilogo = riepRes.recordset.map((r) => {
        const affidato = Number(r.affidato);
        const incassato = Number(r.incassato);
        return {
            id: String(r.Id),
            codice: r.Codice,
            ragioneSociale: r.RagioneSociale,
            pratiche: Number(r.pratiche),
            affidato,
            incassato,
            percentuale: affidato > 0 ? (incassato / affidato) * 100 : 0,
        };
    });
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
    const incRes = await incFilterReq.query(`
    SELECT i.Metodo AS metodo,
      SUM(i.Importo) AS importo,
      COUNT(*) AS pezzi,
      SUM(CASE WHEN i.Data >= @inizioMese THEN i.Importo ELSE 0 END) AS meseImporto,
      SUM(CASE WHEN i.Data >= @inizioMese THEN 1 ELSE 0 END) AS mesePezzi
    FROM dbo.Incassi i
    ${incJoin}
    WHERE ${incClauses.join(" AND ")}
    GROUP BY i.Metodo
  `);
    tick();
    const inizioOggi = oggi;
    const fineOggi = new Date(oggi);
    fineOggi.setUTCHours(23, 59, 59, 999);
    const prodReq = pool.request();
    prodReq.input("tenantId", sql.UniqueIdentifier, tenantId);
    prodReq.input("gte", sql.DateTime2, inizioOggi);
    prodReq.input("lte", sql.DateTime2, fineOggi);
    if (sedeId)
        prodReq.input("sedeId", sql.UniqueIdentifier, sedeId);
    const prodRes = await prodReq.query(`
    SELECT u.Id, u.Name, COUNT(a.Id) AS attivita
    FROM dbo.Users u
    LEFT JOIN dbo.Attivita a ON a.UserId = u.Id AND a.CreatedAt >= @gte AND a.CreatedAt <= @lte
    WHERE u.TenantId = @tenantId AND u.Active = 1 AND u.Role IN (N'OPERATOR', N'OPERATORE', N'SUPERVISOR')
    ${sedeId ? "AND u.SedeId = @sedeId" : ""}
    GROUP BY u.Id, u.Name
    ORDER BY u.Name
  `);
    tick();
    const alertReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    alertReq.input("oggi", sql.DateTime2, oggi);
    alertReq.input("tra7", sql.DateTime2, tra7gg);
    if (sedeId)
        alertReq.input("sedeId", sql.UniqueIdentifier, sedeId);
    const alertRes = await alertReq.query(`
    SELECT
      SUM(CASE WHEN p.Scadenza < @oggi AND p.Stato NOT IN ${STATI_CHIUSI_SQL} THEN 1 ELSE 0 END) AS scaduteAdmin,
      SUM(CASE WHEN p.Scadenza >= @oggi AND p.Scadenza <= @tra7 AND p.Stato NOT IN ${STATI_CHIUSI_SQL} THEN 1 ELSE 0 END) AS inScadenza7gg,
      SUM(CASE WHEN p.AssegnatarioId IS NULL AND p.Stato NOT IN ${STATI_CHIUSI_SQL} THEN 1 ELSE 0 END) AS nonAssegnate
    FROM dbo.Pratiche p
    ${sedeJoin}
    WHERE p.TenantId = @tenantId ${sedeClause}
  `);
    tick();
    const opCountReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    if (sedeId)
        opCountReq.input("sedeId", sql.UniqueIdentifier, sedeId);
    const opCountRes = await opCountReq.query(`
    SELECT COUNT(*) AS cnt FROM dbo.Users
    WHERE TenantId = @tenantId AND Active = 1 AND Role IN (N'OPERATOR', N'OPERATORE', N'SUPERVISOR')
    ${sedeId ? "AND SedeId = @sedeId" : ""}
  `);
    const lottiMap = new Map();
    for (const row of lottiRes.recordset) {
        const lotto = row.NumeroMandante?.trim();
        if (!lotto)
            continue;
        const set = lottiMap.get(String(row.MandanteId)) ?? new Set();
        set.add(lotto);
        lottiMap.set(String(row.MandanteId), set);
    }
    const mandantiAttivi = mandantiRes.recordset.map((m) => ({
        id: String(m.Id),
        codice: m.Codice,
    }));
    const mandantiFiltriUi = mandantiRes.recordset.map((m) => {
        const fromConfig = parsePerimetriNames(m.PerimetriJson);
        const fromPratiche = [...(lottiMap.get(String(m.Id)) ?? [])];
        const perimetri = [...new Set([...fromConfig, ...fromPratiche])].sort((a, b) => a.localeCompare(b, "it"));
        return {
            id: String(m.Id),
            codice: m.Codice,
            ragioneSociale: m.RagioneSociale,
            perimetri,
        };
    });
    tick();
    const caricoReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    if (sedeId)
        caricoReq.input("sedeId", sql.UniqueIdentifier, sedeId);
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
    const esitiReq = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    if (sedeId)
        esitiReq.input("sedeId", sql.UniqueIdentifier, sedeId);
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
    if (sedeId)
        incMeseReq.input("sedeId", sql.UniqueIdentifier, sedeId);
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
    const incassiPerMandanteMese = buildIncassiPerMandanteMese(incMeseRes.recordset, mandantiAttivi, mesiIndietro, oggi);
    return {
        sediOpts: sediRes.recordset.map((s) => ({
            id: String(s.Id),
            nome: s.Nome,
        })),
        operatoriCount: Number(opCountRes.recordset[0]?.cnt ?? 0),
        mandantiRiepilogo,
        mandantiFiltriUi,
        tipologieIncasso: incRes.recordset.map((r) => ({
            metodo: r.metodo,
            pezzi: Number(r.pezzi),
            importo: Number(r.importo),
            meseImporto: Number(r.meseImporto),
            mesePezzi: Number(r.mesePezzi),
        })),
        produttivita: prodRes.recordset.map((r) => ({
            name: r.Name,
            attivita: Number(r.attivita),
        })),
        caricoGruppi: caricoRes.recordset.map((r) => ({
            nome: r.nome,
            aperte: Number(r.aperte),
            totali: Number(r.totali),
            membri: Number(r.membri),
        })),
        esitiContatto: esitiRes.recordset.map((r) => ({
            esitoContatto: r.esitoContatto,
            count: Number(r.cnt),
        })),
        scaduteAdmin: Number(alertRes.recordset[0]?.scaduteAdmin ?? 0),
        inScadenza7gg: Number(alertRes.recordset[0]?.inScadenza7gg ?? 0),
        nonAssegnate: Number(alertRes.recordset[0]?.nonAssegnate ?? 0),
        incassiPerMandanteMese,
        mandantiAttivi,
    };
}
async function loadAmministrazioneSection(pool, req, tick) {
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
    if (sedeOps)
        opReq.input("sedeId", sql.UniqueIdentifier, sedeOps);
    const opRes = await opReq.query(`
    SELECT COUNT(*) AS cnt FROM dbo.Users
    WHERE TenantId = @tenantId AND Active = 1 AND Role IN (N'OPERATOR', N'OPERATORE', N'SUPERVISOR')
    ${sedeOps ? "AND SedeId = @sedeId" : ""}
  `);
    let provvigioniMeseSum = null;
    let provvigioniDaLiquidareSum = null;
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
        sediOpts: sediRes.recordset.map((s) => ({
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
