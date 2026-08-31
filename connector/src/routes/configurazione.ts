import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  deleteManyConfigurazione,
  getConfigurazioneByChiave,
  listConfigurazione,
  upsertConfigurazione,
} from "../services/configurazioneService.js";

export function createConfigurazioneRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const items = await listConfigurazione(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:chiave", resolveTenant, async (req, res, next) => {
    try {
      const item = await getConfigurazioneByChiave(
        cfg.db,
        req.tenant!.tenantId,
        decodeURIComponent(String(req.params.chiave))
      );
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/upsert", resolveTenant, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const item = await upsertConfigurazione(cfg.db, req.tenant!.tenantId, {
        chiave: String(body.chiave || ""),
        valore: String(body.valore ?? ""),
        categoria: String(body.categoria || ""),
      });
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/delete-many", resolveTenant, async (req, res, next) => {
    try {
      const result = await deleteManyConfigurazione(
        cfg.db,
        req.tenant!.tenantId,
        req.body?.filter ?? {}
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
