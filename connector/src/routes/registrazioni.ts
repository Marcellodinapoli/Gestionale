import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  createRegistrazione,
  deleteManyRegistrazioni,
  findFirstRegistrazione,
  listRegistrazioni,
} from "../services/registrazioniService.js";

export function createRegistrazioniRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const result = await listRegistrazioni(cfg.db, {
        tenantId: req.tenant!.tenantId,
        filter: req.body?.filter,
        skip: req.body?.skip,
        take: req.body?.take,
        includeOperatore: Boolean(req.body?.includeOperatore),
        includePraticaDebitore: Boolean(req.body?.includePraticaDebitore),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/find-first", resolveTenant, async (req, res, next) => {
    try {
      const item = await findFirstRegistrazione(cfg.db, req.tenant!.tenantId, req.body?.filter ?? {});
      res.json({ item: item ?? null });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createRegistrazione(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/delete-many", resolveTenant, async (req, res, next) => {
    try {
      const result = await deleteManyRegistrazioni(cfg.db, req.tenant!.tenantId, req.body?.filter ?? {});
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
