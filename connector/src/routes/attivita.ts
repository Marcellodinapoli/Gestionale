import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  countAttivita,
  createAttivita,
  deleteManyAttivita,
  getAttivitaById,
  groupByUserIdAttivita,
  listAttivita,
  toggleFissaAttivita,
  updateAttivita,
  updateManyAttivita,
} from "../services/attivitaService.js";

export function createAttivitaRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const result = await listAttivita(cfg.db, {
        tenantId: req.tenant!.tenantId,
        filter: req.body?.filter,
        skip: req.body?.skip,
        take: req.body?.take,
        orderBy: req.body?.orderBy,
        includeUser: Boolean(req.body?.includeUser),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/count", resolveTenant, async (req, res, next) => {
    try {
      const total = await countAttivita(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ total });
    } catch (err) {
      next(err);
    }
  });

  router.post("/group-by-user", resolveTenant, async (req, res, next) => {
    try {
      const items = await groupByUserIdAttivita(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post("/update-many", resolveTenant, async (req, res, next) => {
    try {
      const result = await updateManyAttivita(
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
      const result = await deleteManyAttivita(cfg.db, req.tenant!.tenantId, req.body?.filter ?? {});
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/toggle-fissa", resolveTenant, async (req, res, next) => {
    try {
      await toggleFissaAttivita(
        cfg.db,
        req.tenant!.tenantId,
        String(req.body?.attivitaId),
        String(req.body?.praticaId),
        Boolean(req.body?.fissata)
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createAttivita(cfg.db, req.tenant!.tenantId, req.body);
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await getAttivitaById(cfg.db, req.tenant!.tenantId, String(req.params.id));
      if (!item) {
        res.status(404).json({ error: "Attività non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateAttivita(
        cfg.db,
        req.tenant!.tenantId,
        String(req.params.id),
        req.body ?? {}
      );
      if (!item) {
        res.status(404).json({ error: "Attività non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
