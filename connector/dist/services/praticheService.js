import { sql, getPool } from "../db/pool.js";
import { applyScope } from "./praticheScope.js";
const PRATICA_COLS = `
  p.Id, p.TenantId, p.Numero, p.NumeroMandante, p.Contratto, p.Commessa,
  p.MandanteId, p.DebitoreId, p.AssegnatarioId, p.OperatoreTitolareId,
  p.Stato, p.Capitale, p.Interessi, p.Spese, p.SpeseRecupero,
  p.ImportoTotale, p.TotIncassato, p.Residuo, p.ImportoRata, p.RateArretrate,
  p.NettoDaPagare, p.NumeroRateScadute, p.CodiceScarico, p.CodiceScaricoAt,
  p.DataAffido, p.Scadenza, p.EsitoContatto, p.TipoContatto,
  p.MemoAt, p.PromessaAt, p.PromessaImporto, p.UltimaLavorazioneAt,
  p.Note, p.ImportBatchId, p.CreatedAt, p.UpdatedAt
`;
function bindFilter(req, filter, idx) {
    const clauses = [];
    if (!filter)
        return clauses;
    const bind = (name, type, val) => {
        const key = `${name}${idx.n++}`;
        req.input(key, type, val);
        return `@${key}`;
    };
    if (filter.ids?.length) {
        const params = filter.ids.map((id) => bind("id", sql.UniqueIdentifier, id));
        clauses.push(`p.Id IN (${params.join(", ")})`);
    }
    if (filter.idsIn?.length) {
        const params = filter.idsIn.map((id) => bind("idIn", sql.UniqueIdentifier, id));
        clauses.push(`p.Id IN (${params.join(", ")})`);
    }
    if (filter.excludeIds?.length) {
        const params = filter.excludeIds.map((id) => bind("exId", sql.UniqueIdentifier, id));
        clauses.push(`p.Id NOT IN (${params.join(", ")})`);
    }
    if (filter.stato) {
        clauses.push(`p.Stato = ${bind("stato", sql.NVarChar(50), filter.stato)}`);
    }
    if (filter.stati?.length) {
        const params = filter.stati.map((s) => bind("st", sql.NVarChar(50), s));
        clauses.push(`p.Stato IN (${params.join(", ")})`);
    }
    if (filter.notStati?.length) {
        const params = filter.notStati.map((s) => bind("nst", sql.NVarChar(50), s));
        clauses.push(`p.Stato NOT IN (${params.join(", ")})`);
    }
    if (filter.esito) {
        clauses.push(`p.EsitoContatto = ${bind("esito", sql.NVarChar(50), filter.esito)}`);
    }
    if (filter.mandanteId) {
        clauses.push(`p.MandanteId = ${bind("mand", sql.UniqueIdentifier, filter.mandanteId)}`);
    }
    if (filter.mandanteIds?.length) {
        const params = filter.mandanteIds.map((id) => bind("mandId", sql.UniqueIdentifier, id));
        clauses.push(`p.MandanteId IN (${params.join(", ")})`);
    }
    if (filter.assegnatarioId) {
        clauses.push(`p.AssegnatarioId = ${bind("ass", sql.UniqueIdentifier, filter.assegnatarioId)}`);
    }
    if (filter.operatoreId) {
        const op = bind("opId", sql.UniqueIdentifier, filter.operatoreId);
        clauses.push(`(p.AssegnatarioId = ${op} OR p.OperatoreTitolareId = ${op})`);
    }
    if (filter.numeroMandante) {
        clauses.push(`p.NumeroMandante = ${bind("lotto", sql.NVarChar(100), filter.numeroMandante)}`);
    }
    if (filter.numeroMandanteNotNull) {
        clauses.push(`p.NumeroMandante IS NOT NULL`);
    }
    if (filter.q) {
        const q = bind("q", sql.NVarChar(100), `%${filter.q}%`);
        clauses.push(`(p.Numero LIKE ${q} OR p.NumeroMandante LIKE ${q})`);
    }
    if (filter.codScarico) {
        clauses.push(`p.CodiceScarico = ${bind("codSc", sql.NVarChar(20), filter.codScarico)}`);
    }
    if (filter.hasAssegnatario === true)
        clauses.push(`p.AssegnatarioId IS NOT NULL`);
    if (filter.hasAssegnatario === false)
        clauses.push(`p.AssegnatarioId IS NULL`);
    if (filter.residuoGte != null) {
        clauses.push(`p.Residuo >= ${bind("resGte", sql.Decimal(18, 2), filter.residuoGte)}`);
    }
    if (filter.residuoLte != null) {
        clauses.push(`p.Residuo <= ${bind("resLte", sql.Decimal(18, 2), filter.residuoLte)}`);
    }
    if (filter.importoTotGte != null) {
        clauses.push(`p.ImportoTotale >= ${bind("itGte", sql.Decimal(18, 2), filter.importoTotGte)}`);
    }
    if (filter.importoTotLte != null) {
        clauses.push(`p.ImportoTotale <= ${bind("itLte", sql.Decimal(18, 2), filter.importoTotLte)}`);
    }
    if (filter.totIncassatoGte != null) {
        clauses.push(`p.TotIncassato >= ${bind("tiGte", sql.Decimal(18, 2), filter.totIncassatoGte)}`);
    }
    if (filter.totIncassatoLte != null) {
        clauses.push(`p.TotIncassato <= ${bind("tiLte", sql.Decimal(18, 2), filter.totIncassatoLte)}`);
    }
    if (filter.importoRataGte != null) {
        clauses.push(`p.ImportoRata >= ${bind("irGte", sql.Decimal(18, 2), filter.importoRataGte)}`);
    }
    if (filter.importoRataLte != null) {
        clauses.push(`p.ImportoRata <= ${bind("irLte", sql.Decimal(18, 2), filter.importoRataLte)}`);
    }
    if (filter.nPraticaGte) {
        clauses.push(`p.Numero >= ${bind("npGte", sql.NVarChar(50), filter.nPraticaGte)}`);
    }
    if (filter.nPraticaLte) {
        clauses.push(`p.Numero <= ${bind("npLte", sql.NVarChar(50), filter.nPraticaLte)}`);
    }
    const dateClause = (col, gte, lt) => {
        if (gte)
            clauses.push(`${col} >= ${bind(`${col}Gte`, sql.DateTime2(3), new Date(gte))}`);
        if (lt)
            clauses.push(`${col} < ${bind(`${col}Lt`, sql.DateTime2(3), new Date(lt))}`);
    };
    dateClause("p.DataAffido", filter.affidoGte, filter.affidoLt);
    dateClause("p.Scadenza", filter.scadenzaGte, filter.scadenzaLt);
    dateClause("p.PromessaAt", filter.promessaGte, filter.promessaLt);
    dateClause("p.MemoAt", filter.memoAtGte ?? filter.memoGte, filter.memoAtLt ?? filter.memoLt);
    if (filter.debitoreContains) {
        const t = bind("deb", sql.NVarChar(100), `%${filter.debitoreContains}%`);
        clauses.push(`EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND (d.Nome LIKE ${t} OR d.Cognome LIKE ${t}))`);
    }
    if (filter.capGte || filter.capLte) {
        if (filter.capGte)
            clauses.push(`EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND d.Cap >= ${bind("capGte", sql.NVarChar(10), filter.capGte)})`);
        if (filter.capLte)
            clauses.push(`EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND d.Cap <= ${bind("capLte", sql.NVarChar(10), filter.capLte)})`);
    }
    if (filter.cittaContains) {
        const t = bind("citta", sql.NVarChar(100), `%${filter.cittaContains}%`);
        clauses.push(`EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND d.Citta LIKE ${t})`);
    }
    if (filter.provContains) {
        const t = bind("prov", sql.NVarChar(5), `%${filter.provContains}%`);
        clauses.push(`EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND d.Provincia LIKE ${t})`);
    }
    if (filter.telefonoContains) {
        const t = bind("tel", sql.NVarChar(50), `%${filter.telefonoContains}%`);
        clauses.push(`(
      EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND d.Telefono LIKE ${t})
      OR EXISTS (SELECT 1 FROM dbo.DebitoreRecapiti dr INNER JOIN dbo.Debitori d ON d.Id = dr.DebitoreId WHERE d.Id = p.DebitoreId AND dr.Valore LIKE ${t})
      OR EXISTS (SELECT 1 FROM dbo.Garanti g WHERE g.PraticaId = p.Id AND g.Telefono LIKE ${t})
    )`);
    }
    if (filter.cfPivaContains) {
        const t = bind("cf", sql.NVarChar(50), `%${filter.cfPivaContains}%`);
        clauses.push(`(
      EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND d.CodiceFiscale LIKE ${t})
      OR EXISTS (SELECT 1 FROM dbo.Garanti g WHERE g.PraticaId = p.Id AND g.CodiceFiscale LIKE ${t})
    )`);
    }
    if (filter.garanteContains) {
        const t = bind("gar", sql.NVarChar(100), `%${filter.garanteContains}%`);
        clauses.push(`EXISTS (SELECT 1 FROM dbo.Garanti g WHERE g.PraticaId = p.Id AND (g.Nome LIKE ${t} OR g.Cognome LIKE ${t} OR g.CodiceFiscale LIKE ${t}))`);
    }
    if (filter.noteContains) {
        const t = bind("note", sql.NVarChar(200), `%${filter.noteContains}%`);
        clauses.push(`(p.Note LIKE ${t} OR EXISTS (SELECT 1 FROM dbo.Attivita a WHERE a.PraticaId = p.Id AND a.Nota LIKE ${t}))`);
    }
    if (filter.rateScadute === true) {
        clauses.push(`EXISTS (SELECT 1 FROM dbo.PianoRata r WHERE r.PraticaId = p.Id AND r.Pagata = 0 AND r.Scadenza < SYSUTCDATETIME())`);
    }
    if (filter.rateScadute === false) {
        clauses.push(`NOT EXISTS (SELECT 1 FROM dbo.PianoRata r WHERE r.PraticaId = p.Id AND r.Pagata = 0 AND r.Scadenza < SYSUTCDATETIME())`);
    }
    if (filter.searchCampo && filter.searchTerm) {
        const term = filter.searchTerm.trim();
        if (term.length >= 2) {
            const t = bind("search", sql.NVarChar(100), `%${term}%`);
            switch (filter.searchCampo) {
                case "telefono":
                    clauses.push(`(
            EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND d.Telefono LIKE ${t})
            OR EXISTS (SELECT 1 FROM dbo.DebitoreRecapiti dr INNER JOIN dbo.Debitori d ON d.Id = dr.DebitoreId WHERE d.Id = p.DebitoreId AND dr.Valore LIKE ${t})
          )`);
                    break;
                case "nominativo":
                    clauses.push(`EXISTS (SELECT 1 FROM dbo.Debitori d WHERE d.Id = p.DebitoreId AND (d.Nome LIKE ${t} OR d.Cognome LIKE ${t}))`);
                    break;
                case "note":
                    clauses.push(`(p.Note LIKE ${t} OR EXISTS (SELECT 1 FROM dbo.Attivita a WHERE a.PraticaId = p.Id AND a.Nota LIKE ${t}))`);
                    break;
                default:
                    clauses.push(`(p.Numero LIKE ${t} OR p.Contratto LIKE ${t} OR p.Commessa LIKE ${t})`);
            }
        }
    }
    return clauses;
}
function buildOrderBy(sortField, sortDir = "desc") {
    const dir = sortDir === "asc" ? "ASC" : "DESC";
    switch (sortField) {
        case "numero": return `p.Numero ${dir}`;
        case "debitore": return `d.Cognome ${dir}, d.Nome ${dir}`;
        case "cap": return `d.Cap ${dir}`;
        case "citta": return `d.Citta ${dir}`;
        case "prov": return `d.Provincia ${dir}`;
        case "telefono": return `d.Telefono ${dir}`;
        case "dataAffido": return `p.DataAffido ${dir}`;
        case "scadenza": return `p.Scadenza ${dir}`;
        case "mandante": return `m.Codice ${dir}`;
        case "lotto": return `p.NumeroMandante ${dir}`;
        case "codScarico": return `p.CodiceScarico ${dir}`;
        case "stato": return `p.Stato ${dir}`;
        case "esito": return `p.EsitoContatto ${dir}`;
        case "residuo": return `p.Residuo ${dir}`;
        case "importoTot": return `p.ImportoTotale ${dir}`;
        case "totIncassato": return `p.TotIncassato ${dir}`;
        case "ultimaLavorazione":
        default:
            return `p.UltimaLavorazioneAt ${sortDir === "asc" ? "ASC" : "DESC"}, p.Numero ASC`;
    }
}
function buildWhere(cfg, scope, filter) {
    const pool = getPool(cfg);
    void pool;
    const req = new sql.Request();
    const idx = { n: 0 };
    const clauses = [...applyScope(scope, req), ...bindFilter(req, filter, idx)];
    return { req, where: clauses.join(" AND ") || "1=1" };
}
export async function listPratiche(cfg, input) {
    const pool = await getPool(cfg);
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
    const skip = input.skip ?? (page - 1) * pageSize;
    const take = input.take ?? pageSize;
    const idx = { n: 0 };
    const req = pool.request();
    const scopeClauses = applyScope(input.scope, req);
    const filterClauses = bindFilter(req, input.filter, idx);
    const where = [...scopeClauses, ...filterClauses].join(" AND ");
    const orderBy = buildOrderBy(input.sortField, input.sortDir ?? "desc");
    const countReq = pool.request();
    applyScope(input.scope, countReq);
    bindFilter(countReq, input.filter, { n: 0 });
    const start = performance.now();
    const [rows, countRes] = await Promise.all([
        req.query(`
      SELECT ${PRATICA_COLS},
        d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome, d.Telefono AS DebitoreTelefono,
        d.Cap AS DebitoreCap, d.Citta AS DebitoreCitta, d.Provincia AS DebitoreProvincia,
        d.CodiceFiscale AS DebitoreCodiceFiscale, d.Email AS DebitoreEmail,
        d.Indirizzo AS DebitoreIndirizzo,
        m.Codice AS MandanteCodice, m.RagioneSociale AS MandanteRagioneSociale,
        u.Name AS AssegnatarioName
      FROM dbo.Pratiche p
      INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
      LEFT JOIN dbo.Users u ON u.Id = p.AssegnatarioId
      WHERE ${where}
      ORDER BY ${orderBy}
      OFFSET ${skip} ROWS FETCH NEXT ${take} ROWS ONLY
    `),
        countReq.query(`SELECT COUNT(*) AS total FROM dbo.Pratiche p WHERE ${where}`),
    ]);
    return {
        items: rows.recordset,
        total: countRes.recordset[0]?.total ?? 0,
        page,
        pageSize: take,
        queryMs: Math.round(performance.now() - start),
    };
}
export async function countPratiche(cfg, input) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const where = [...applyScope(input.scope, req), ...bindFilter(req, input.filter, { n: 0 })].join(" AND ");
    const res = await req.query(`SELECT COUNT(*) AS total FROM dbo.Pratiche p WHERE ${where}`);
    return res.recordset[0]?.total ?? 0;
}
export async function getPraticaById(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    const result = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`
      SELECT ${PRATICA_COLS},
        d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome, d.Telefono AS DebitoreTelefono,
        d.Cap AS DebitoreCap, d.Citta AS DebitoreCitta, d.Provincia AS DebitoreProvincia,
        d.CodiceFiscale AS DebitoreCodiceFiscale, d.Email AS DebitoreEmail,
        d.Indirizzo AS DebitoreIndirizzo,
        m.Codice AS MandanteCodice, m.RagioneSociale AS MandanteRagioneSociale,
        u.Name AS AssegnatarioName
      FROM dbo.Pratiche p
      INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
      LEFT JOIN dbo.Users u ON u.Id = p.AssegnatarioId
      WHERE p.TenantId = @tenantId AND p.Id = @id
    `);
    return result.recordset[0] ?? null;
}
export async function getPraticaRelations(cfg, tenantId, praticaId, include) {
    const pool = await getPool(cfg);
    const out = {};
    if (include.includes("debitoreRecapiti") || include.includes("debitore")) {
        const pratica = await getPraticaById(cfg, tenantId, praticaId);
        if (pratica) {
            const rec = await pool.request()
                .input("debitoreId", sql.UniqueIdentifier, pratica.DebitoreId)
                .query(`SELECT * FROM dbo.DebitoreRecapiti WHERE DebitoreId = @debitoreId ORDER BY Tipo, Ordine`);
            out.debitoreRecapiti = rec.recordset;
        }
    }
    if (include.includes("rate")) {
        const rate = await pool.request()
            .input("praticaId", sql.UniqueIdentifier, praticaId)
            .query(`SELECT * FROM dbo.PianoRate WHERE PraticaId = @praticaId ORDER BY NumeroRata`);
        out.rate = rate.recordset;
    }
    if (include.includes("incassi") || include.includes("incassiUser")) {
        const inc = await pool.request()
            .input("praticaId", sql.UniqueIdentifier, praticaId)
            .query(`
        SELECT i.*, u.Name AS UserName
        FROM dbo.Incassi i
        LEFT JOIN dbo.Users u ON u.Id = i.UserId
        WHERE i.PraticaId = @praticaId
        ORDER BY i.Data DESC
      `);
        out.incassi = inc.recordset;
    }
    if (include.includes("garanti") || include.includes("garantiRecapiti")) {
        const gar = await pool.request()
            .input("praticaId", sql.UniqueIdentifier, praticaId)
            .query(`SELECT * FROM dbo.Garanti WHERE PraticaId = @praticaId ORDER BY Ordine`);
        out.garanti = gar.recordset;
        if (include.includes("garantiRecapiti") && gar.recordset.length) {
            const ids = gar.recordset.map((g) => g.Id);
            const req = pool.request();
            ids.forEach((gid, i) => req.input(`g${i}`, sql.UniqueIdentifier, gid));
            const rec = await req.query(`
        SELECT * FROM dbo.GaranteRecapiti
        WHERE GaranteId IN (${ids.map((_, i) => `@g${i}`).join(", ")})
        ORDER BY Ordine
      `);
            out.garanteRecapiti = rec.recordset;
        }
    }
    if (include.includes("attivita") || include.includes("attivitaUser")) {
        const att = await pool.request()
            .input("praticaId", sql.UniqueIdentifier, praticaId)
            .query(`
        SELECT a.*, u.Name AS UserName
        FROM dbo.Attivita a
        LEFT JOIN dbo.Users u ON u.Id = a.UserId
        WHERE a.PraticaId = @praticaId
        ORDER BY a.CreatedAt DESC
      `);
        out.attivita = att.recordset;
    }
    if (include.includes("fatture")) {
        const fat = await pool.request()
            .input("praticaId", sql.UniqueIdentifier, praticaId)
            .query(`SELECT * FROM dbo.Fatture WHERE PraticaId = @praticaId ORDER BY DataFattura`);
        out.fatture = fat.recordset;
    }
    if (include.includes("documenti")) {
        const doc = await pool.request()
            .input("praticaId", sql.UniqueIdentifier, praticaId)
            .query(`SELECT TOP 50 * FROM dbo.Documenti WHERE PraticaId = @praticaId ORDER BY CreatedAt DESC`);
        out.documenti = doc.recordset;
    }
    if (include.includes("importBatch")) {
        const pr = await getPraticaById(cfg, tenantId, praticaId);
        if (pr?.ImportBatchId) {
            const batch = await pool.request()
                .input("batchId", sql.UniqueIdentifier, pr.ImportBatchId)
                .query(`SELECT Id, Perimetro, Lotto, AffidoIl FROM dbo.ImportBatch WHERE Id = @batchId`);
            out.importBatch = batch.recordset[0] ?? null;
        }
    }
    return out;
}
export async function searchPratiche(cfg, input) {
    return listPratiche(cfg, {
        scope: { tenantId: input.tenantId, role: "ADMIN", userId: input.tenantId },
        filter: {
            stato: input.stato,
            mandanteId: input.mandanteId,
            assegnatarioId: input.assegnatarioId,
            q: input.q,
        },
        page: input.page,
        pageSize: input.pageSize,
    });
}
export async function groupByNumeroMandante(cfg, scope, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const where = [...applyScope(scope, req), ...bindFilter(req, filter, { n: 0 })].join(" AND ");
    const res = await req.query(`
    SELECT p.NumeroMandante
    FROM dbo.Pratiche p
    WHERE ${where} AND p.NumeroMandante IS NOT NULL
    GROUP BY p.NumeroMandante
  `);
    return res.recordset.map((r) => ({
        numeroMandante: r.NumeroMandante,
    }));
}
export async function idsAffidoTemporaneo(cfg, tenantId) {
    const pool = await getPool(cfg);
    const res = await pool.request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .query(`
      SELECT Id FROM dbo.Pratiche
      WHERE TenantId = @tenantId
        AND AssegnatarioId IS NOT NULL
        AND OperatoreTitolareId IS NOT NULL
        AND AssegnatarioId <> OperatoreTitolareId
    `);
    return res.recordset.map((r) => String(r.Id));
}
export async function idsImportoTotale(cfg, tenantId, da, a) {
    const pool = await getPool(cfg);
    const req = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    const clauses = ["TenantId = @tenantId"];
    if (da != null) {
        req.input("da", sql.Decimal(18, 2), da);
        clauses.push("ImportoTotale >= @da");
    }
    if (a != null) {
        req.input("a", sql.Decimal(18, 2), a);
        clauses.push("ImportoTotale <= @a");
    }
    const res = await req.query(`SELECT Id FROM dbo.Pratiche WHERE ${clauses.join(" AND ")}`);
    return res.recordset.map((r) => String(r.Id));
}
export async function idsTotIncassato(cfg, tenantId, da, a) {
    const pool = await getPool(cfg);
    const req = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
    const clauses = ["TenantId = @tenantId"];
    if (da != null) {
        req.input("da", sql.Decimal(18, 2), da);
        clauses.push("TotIncassato >= @da");
    }
    if (a != null) {
        req.input("a", sql.Decimal(18, 2), a);
        clauses.push("TotIncassato <= @a");
    }
    const res = await req.query(`SELECT Id FROM dbo.Pratiche WHERE ${clauses.join(" AND ")}`);
    return res.recordset.map((r) => String(r.Id));
}
export async function nextNumeroPratica(cfg, tenantId) {
    const pool = await getPool(cfg);
    const res = await pool.request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .query(`
      SELECT TOP 1 Numero FROM dbo.Pratiche
      WHERE TenantId = @tenantId
      ORDER BY CreatedAt DESC
    `);
    const last = res.recordset[0]?.Numero;
    const year = new Date().getFullYear();
    const match = last?.match(/(\d+)$/);
    const n = match ? Number(match[1]) + 1 : 1;
    return `PRC-${year}-${String(n).padStart(4, "0")}`;
}
export async function updatePratica(cfg, tenantId, id, data) {
    const pool = await getPool(cfg);
    const allowed = new Set([
        "UpdatedAt", "UltimaLavorazioneAt", "CodiceScarico", "CodiceScaricoAt",
        "Stato", "EsitoContatto", "TipoContatto", "MemoAt", "PromessaAt", "PromessaImporto",
        "AssegnatarioId", "OperatoreTitolareId", "Residuo", "DebitoreId", "MandanteId",
        "Numero", "NumeroMandante", "Contratto", "Commessa", "DataAffido", "Scadenza",
        "Capitale", "Interessi", "Spese", "SpeseRecupero", "ImportoRata", "RateArretrate",
        "NettoDaPagare", "ImportBatchId", "Note",
    ]);
    const map = {
        updatedAt: "UpdatedAt", ultimaLavorazioneAt: "UltimaLavorazioneAt",
        codiceScarico: "CodiceScarico", codiceScaricoAt: "CodiceScaricoAt",
        stato: "Stato", esitoContatto: "EsitoContatto", tipoContatto: "TipoContatto",
        memoAt: "MemoAt", promessaAt: "PromessaAt", promessaImporto: "PromessaImporto",
        assegnatarioId: "AssegnatarioId", operatoreTitolareId: "OperatoreTitolareId",
        residuo: "Residuo", debitoreId: "DebitoreId", mandanteId: "MandanteId",
        numero: "Numero", numeroMandante: "NumeroMandante", contratto: "Contratto",
        commessa: "Commessa", dataAffido: "DataAffido", scadenza: "Scadenza",
        capitale: "Capitale", interessi: "Interessi", spese: "Spese",
        speseRecupero: "SpeseRecupero", importoRata: "ImportoRata",
        rateArretrate: "RateArretrate", nettoDaPagare: "NettoDaPagare",
        importBatchId: "ImportBatchId", note: "Note",
    };
    const req = pool.request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id);
    const sets = ["UpdatedAt = SYSUTCDATETIME()"];
    if (!data.updatedAt && data.updatedAt !== null) {
        // always touch UpdatedAt
    }
    for (const [key, val] of Object.entries(data)) {
        const col = map[key];
        if (!col || !allowed.has(col))
            continue;
        const param = `u_${col}`;
        if (val === null) {
            req.input(param, sql.NVarChar(1), null);
            sets.push(`${col} = NULL`);
        }
        else if (val instanceof Date) {
            req.input(param, sql.DateTime2(3), val);
            sets.push(`${col} = @${param}`);
        }
        else if (typeof val === "number") {
            req.input(param, sql.Decimal(18, 2), val);
            sets.push(`${col} = @${param}`);
        }
        else if (typeof val === "string" && col.endsWith("Id")) {
            req.input(param, sql.UniqueIdentifier, val);
            sets.push(`${col} = @${param}`);
        }
        else {
            req.input(param, sql.NVarChar(500), String(val));
            sets.push(`${col} = @${param}`);
        }
    }
    await req.query(`
    UPDATE dbo.Pratiche SET ${sets.join(", ")}
    WHERE Id = @id AND TenantId = @tenantId
  `);
    return getPraticaById(cfg, tenantId, id);
}
export async function createPratica(cfg, data) {
    const pool = await getPool(cfg);
    const res = await pool.request()
        .input("tenantId", sql.UniqueIdentifier, data.tenantId)
        .input("numero", sql.NVarChar(50), data.numero)
        .input("mandanteId", sql.UniqueIdentifier, data.mandanteId)
        .input("debitoreId", sql.UniqueIdentifier, data.debitoreId)
        .input("stato", sql.NVarChar(50), data.stato ?? "NUOVA")
        .input("capitale", sql.Decimal(18, 2), data.capitale ?? 0)
        .input("interessi", sql.Decimal(18, 2), data.interessi ?? 0)
        .input("spese", sql.Decimal(18, 2), data.spese ?? 0)
        .input("residuo", sql.Decimal(18, 2), data.residuo ?? 0)
        .query(`
      INSERT INTO dbo.Pratiche (TenantId, Numero, MandanteId, DebitoreId, Stato, Capitale, Interessi, Spese, Residuo)
      OUTPUT INSERTED.Id
      VALUES (@tenantId, @numero, @mandanteId, @debitoreId, @stato, @capitale, @interessi, @spese, @residuo)
    `);
    const id = res.recordset[0]?.Id;
    return getPraticaById(cfg, String(data.tenantId), String(id));
}
export async function deletePratica(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    await pool.request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`DELETE FROM dbo.Pratiche WHERE Id = @id AND TenantId = @tenantId`);
}
export async function assignPratica(cfg, tenantId, id, input) {
    const data = {};
    switch (input.tipo) {
        case "ripristina":
            data.assegnatarioId = input.titolareId ?? null;
            break;
        case "unassign":
            data.assegnatarioId = null;
            data.operatoreTitolareId = null;
            data.stato = "NUOVA";
            break;
        case "temporaneo":
            data.assegnatarioId = input.assegnatarioId ?? null;
            data.operatoreTitolareId = input.titolareId ?? null;
            if (input.statoCorrente === "NUOVA")
                data.stato = "AFFIDATA";
            break;
        case "definitivo":
            data.assegnatarioId = input.assegnatarioId ?? null;
            data.operatoreTitolareId = input.assegnatarioId ?? null;
            if (input.statoCorrente === "NUOVA")
                data.stato = "AFFIDATA";
            break;
    }
    return updatePratica(cfg, tenantId, id, data);
}
export async function updateStatoPratica(cfg, tenantId, id, stato, promessaAt) {
    return updatePratica(cfg, tenantId, id, {
        stato,
        ...(promessaAt !== undefined ? { promessaAt } : {}),
    });
}
export async function canAccessPraticaSql(cfg, scope, praticaId, linkedIds) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const where = [...applyScope(scope, req), `p.Id = @praticaId`].join(" AND ");
    req.input("praticaId", sql.UniqueIdentifier, praticaId);
    const direct = await req.query(`SELECT 1 AS ok FROM dbo.Pratiche p WHERE ${where}`);
    if (direct.recordset[0])
        return true;
    if (!linkedIds?.length)
        return false;
    const req2 = pool.request();
    const scope2 = applyScope(scope, req2);
    linkedIds.forEach((lid, i) => req2.input(`lid${i}`, sql.UniqueIdentifier, lid));
    const inList = linkedIds.map((_, i) => `@lid${i}`).join(", ");
    const where2 = [...scope2, `p.Id IN (${inList})`].join(" AND ");
    const sibling = await req2.query(`SELECT TOP 1 1 AS ok FROM dbo.Pratiche p WHERE ${where2}`);
    return Boolean(sibling.recordset[0]);
}
// fix buildWhere unused - remove dead code warning by exporting
export { buildWhere };
