import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  createDocumento,
  createFattura,
  createManyPianoRate,
  createPianoRata,
  deleteDocumentiByPratica,
  deleteFattureByPratica,
  deletePianoRateByPratica,
} from "../services/praticaContabileService.js";

export function createFattureRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createFattura(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/delete-many", resolveTenant, async (req, res, next) => {
    try {
      const praticaId = String(req.body?.praticaId || "");
      const result = await deleteFattureByPratica(cfg.db, req.tenant!.tenantId, praticaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createDocumentiRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createDocumento(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/delete-many", resolveTenant, async (req, res, next) => {
    try {
      const praticaId = String(req.body?.praticaId || "");
      const result = await deleteDocumentiByPratica(cfg.db, req.tenant!.tenantId, praticaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createPianoRateRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createPianoRata(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/create-many", resolveTenant, async (req, res, next) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const result = await createManyPianoRate(cfg.db, req.tenant!.tenantId, items);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/delete-many", resolveTenant, async (req, res, next) => {
    try {
      const praticaId = String(req.body?.praticaId || "");
      const result = await deletePianoRateByPratica(cfg.db, req.tenant!.tenantId, praticaId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
