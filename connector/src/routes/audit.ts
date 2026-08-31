import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import { appendAuditLog, listAuditLogs } from "../services/auditService.js";

export function createAuditRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      await appendAuditLog(cfg.db, req.tenant!.tenantId, req.body);
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const items = await listAuditLogs(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
