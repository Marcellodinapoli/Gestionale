import type { Request, Response, NextFunction } from "express";
import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type TenantContext = {
  tenantId: string;
  slug: string;
};

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export function createTenantResolver(cfg: ConnectorConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (err) {
      next(err);
    }
  };
}

export function apiKeyGuard(cfg: ConnectorConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!cfg.apiKey) return next();
    const key = req.header("x-connector-key");
    if (key !== cfg.apiKey) {
      res.status(401).json({ error: "Non autorizzato" });
      return;
    }
    next();
  };
}
