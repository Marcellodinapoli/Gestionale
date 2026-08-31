import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  aggregateProvvigioni,
  deleteManyProvvigioni,
  groupByProvvigioni,
  listProvvigioni,
  updateManyProvvigioni,
  updateProvvigione,
} from "../services/provvigioniService.js";

export function createProvvigioniRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const result = await listProvvigioni(cfg.db, {
        tenantId: req.tenant!.tenantId,
        filter: req.body?.filter,
        skip: req.body?.skip,
        take: req.body?.take,
        includeOperatore: Boolean(req.body?.includeOperatore),
        includePraticaDebitore: Boolean(req.body?.includePraticaDebitore),
        includeIncasso: Boolean(req.body?.includeIncasso),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/aggregate", resolveTenant, async (req, res, next) => {
    try {
      const result = await aggregateProvvigioni(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/group-by", resolveTenant, async (req, res, next) => {
    try {
      const by = Array.isArray(req.body?.by) ? req.body.by.map(String) : ["operatoreId"];
      const items = await groupByProvvigioni(cfg.db, req.tenant!.tenantId, req.body?.filter, by as never);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateProvvigione(cfg.db, req.tenant!.tenantId, req.params.id, req.body ?? {});
      if (!item) {
        res.status(404).json({ error: "Provvigione non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/update-many", resolveTenant, async (req, res, next) => {
    try {
      const result = await updateManyProvvigioni(
        cfg.db,
        req.tenant!.tenantId,
        req.body?.filter ?? {},
        req.body?.data ?? {}
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/delete-many", resolveTenant, async (req, res, next) => {
    try {
      const result = await deleteManyProvvigioni(cfg.db, req.tenant!.tenantId, req.body?.filter ?? {});
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
