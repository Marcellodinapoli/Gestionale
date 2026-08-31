import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  countSedi,
  createSede,
  getSedeById,
  listSedi,
  updateSede,
} from "../services/sediService.js";

export function createSediRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const items = await listSedi(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post("/count", resolveTenant, async (req, res, next) => {
    try {
      const total = await countSedi(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ total });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await getSedeById(cfg.db, req.tenant!.tenantId, String(req.params.id));
      if (!item) {
        res.status(404).json({ error: "Sede non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createSede(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateSede(cfg.db, req.tenant!.tenantId, String(req.params.id), req.body ?? {});
      if (!item) {
        res.status(404).json({ error: "Sede non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
