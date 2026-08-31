import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  countMandanti,
  createMandante,
  deleteMandante,
  getMandanteById,
  listMandanti,
  updateMandante,
} from "../services/mandantiService.js";

export function createMandantiRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const result = await listMandanti(cfg.db, {
        tenantId: req.tenant!.tenantId,
        filter: body.filter,
        orderBy: body.orderBy,
        orderDir: body.orderDir,
        skip: body.skip,
        take: body.take,
        includePraticaCount: Boolean(body.includePraticaCount),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/count", resolveTenant, async (req, res, next) => {
    try {
      const total = await countMandanti(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ total });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", resolveTenant, async (req, res, next) => {
    try {
      const includeCount = req.query.includeCount === "1" || req.query.includeCount === "true";
      const row = await getMandanteById(cfg.db, req.tenant!.tenantId, req.params.id, includeCount);
      if (!row) {
        res.status(404).json({ error: "Mandante non trovata" });
        return;
      }
      res.json({ item: row });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createMandante(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateMandante(cfg.db, req.tenant!.tenantId, req.params.id, req.body ?? {});
      if (!item) {
        res.status(404).json({ error: "Mandante non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", resolveTenant, async (req, res, next) => {
    try {
      await deleteMandante(cfg.db, req.tenant!.tenantId, req.params.id);
      res.status(204).send();
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      if (e.statusCode === 409) {
        res.status(409).json({ error: e.message });
        return;
      }
      next(err);
    }
  });

  return router;
}
