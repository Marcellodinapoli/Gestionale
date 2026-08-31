import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  countPostazioni,
  createPostazione,
  deletePostazione,
  getPostazioneById,
  listPostazioni,
  updatePostazione,
} from "../services/postazioniService.js";

export function createPostazioniRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const items = await listPostazioni(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post("/count", resolveTenant, async (req, res, next) => {
    try {
      const total = await countPostazioni(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ total });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await getPostazioneById(cfg.db, req.tenant!.tenantId, String(req.params.id));
      if (!item) {
        res.status(404).json({ error: "Postazione non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createPostazione(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updatePostazione(
        cfg.db,
        req.tenant!.tenantId,
        String(req.params.id),
        req.body ?? {}
      );
      if (!item) {
        res.status(404).json({ error: "Postazione non trovata" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", resolveTenant, async (req, res, next) => {
    try {
      await deletePostazione(cfg.db, req.tenant!.tenantId, String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
