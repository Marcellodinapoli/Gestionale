import { sql, getPool } from "../db/pool.js";
export function createTenantResolver(cfg) {
    return async (req, res, next) => {
        const slug = String(req.params.tenantId || "").trim().toLowerCase();
        if (!slug) {
            res.status(400).json({ error: "tenantId mancante" });
            return;
        }
        try {
            const pool = await getPool(cfg.db);
            const result = await pool
                .request()
                .input("slug", sql.NVarChar(50), slug)
                .query(`SELECT Id, Slug FROM dbo.Tenants WHERE Slug = @slug AND Active = 1`);
            const row = result.recordset[0];
            if (!row) {
                res.status(404).json({ error: "Tenant non trovato" });
                return;
            }
            req.tenant = { tenantId: row.Id, slug: row.Slug };
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
export function apiKeyGuard(cfg) {
    return (req, res, next) => {
        if (!cfg.apiKey)
            return next();
        const key = req.header("x-connector-key");
        if (key !== cfg.apiKey) {
            res.status(401).json({ error: "Non autorizzato" });
            return;
        }
        next();
    };
}
