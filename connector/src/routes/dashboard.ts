import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import { getDashboardHome } from "../services/dashboardService.js";
import { getHomeKpiBundle, type HomeKpiRequest } from "../services/dashboardHomeService.js";

export function createDashboardRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  /** Legacy summary KPI (mantenuto per compatibilità). */
  router.get("/home/legacy", resolveTenant, async (req, res, next) => {
    try {
      const start = performance.now();
      const data = await getDashboardHome(cfg.db, req.tenant!.tenantId);
      res.json({ ...data, totalMs: Math.round(performance.now() - start) });
    } catch (err) {
      next(err);
    }
  });

  /** Bundle Home completo — GET con body JSON in query `ctx` o POST body. */
  router.get("/home", resolveTenant, async (req, res, next) => {
    try {
      const start = performance.now();
      const ctxRaw = req.query.ctx;
      const body =
        typeof ctxRaw === "string" && ctxRaw
          ? (JSON.parse(decodeURIComponent(ctxRaw)) as HomeKpiRequest)
          : (req.body as HomeKpiRequest | undefined);
      if (!body?.userId || !body?.role) {
        res.status(400).json({ error: "Contesto Home mancante (userId, role)" });
        return;
      }
      const data = await getHomeKpiBundle(cfg.db, { ...body, tenantId: req.tenant!.tenantId });
      res.json({ ...data, totalMs: Math.round(performance.now() - start) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/home", resolveTenant, async (req, res, next) => {
    try {
      const start = performance.now();
      const body = req.body as HomeKpiRequest;
      if (!body?.userId || !body?.role) {
        res.status(400).json({ error: "Contesto Home mancante" });
        return;
      }
      const data = await getHomeKpiBundle(cfg.db, { ...body, tenantId: req.tenant!.tenantId });
      res.json({ ...data, totalMs: Math.round(performance.now() - start) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
