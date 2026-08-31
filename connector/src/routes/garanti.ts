import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  countGaranteRecapiti,
  createGaranteRecapito,
  deleteGaranteRecapito,
  deleteGaranteRecapitiByGarante,
  deleteGarantiByPratica,
  findFirstGarante,
  findFirstGaranteRecapito,
  findGarantiByCf,
  updateGarante,
  updateGaranteRecapito,
} from "../services/garantiService.js";

export function createGarantiRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/find-first", resolveTenant, async (req, res, next) => {
    try {
      const item = await findFirstGarante(cfg.db, req.body?.filter ?? {});
      res.json({ item: item ?? null });
    } catch (err) {
      next(err);
    }
  });

  router.post("/ids-by-cf", resolveTenant, async (req, res, next) => {
    try {
      const variants = Array.isArray(req.body?.variants) ? req.body.variants.map(String) : [];
      const items = await findGarantiByCf(cfg.db, req.tenant!.tenantId, variants);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateGarante(cfg.db, req.tenant!.tenantId, req.params.id, req.body ?? {});
      if (!item) {
        res.status(404).json({ error: "Garante non trovato" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/delete-by-pratica", resolveTenant, async (req, res, next) => {
    try {
      await deleteGarantiByPratica(cfg.db, req.tenant!.tenantId, String(req.body?.praticaId || ""));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post("/recapiti/count", resolveTenant, async (req, res, next) => {
    try {
      const total = await countGaranteRecapiti(cfg.db, String(req.body?.garanteId), req.body?.tipo);
      res.json({ total });
    } catch (err) {
      next(err);
    }
  });

  router.post("/recapiti/find-first", resolveTenant, async (req, res, next) => {
    try {
      const item = await findFirstGaranteRecapito(cfg.db, req.body ?? {});
      res.json({ item: item ?? null });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:garanteId/recapiti", resolveTenant, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const item = await createGaranteRecapito(cfg.db, {
        garanteId: req.params.garanteId,
        tipo: String(body.tipo),
        valore: String(body.valore),
        ordine: body.ordine,
        stato: body.stato,
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/recapiti/:recapitoId", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateGaranteRecapito(cfg.db, req.params.recapitoId, req.body ?? {});
      if (!item) {
        res.status(404).json({ error: "Recapito non trovato" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/recapiti/:recapitoId", resolveTenant, async (req, res, next) => {
    try {
      await deleteGaranteRecapito(cfg.db, req.params.recapitoId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:garanteId/recapiti", resolveTenant, async (req, res, next) => {
    try {
      await deleteGaranteRecapitiByGarante(cfg.db, req.params.garanteId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
