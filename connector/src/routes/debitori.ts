import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  countRecapiti,
  createDebitore,
  createRecapito,
  deleteDebitore,
  deleteRecapito,
  deleteRecapitiByDebitore,
  findFirstRecapito,
  getDebitoreById,
  idsByCodiceFiscale,
  listDebitori,
  listRecapiti,
  updateDebitore,
  updateRecapito,
} from "../services/debitoriService.js";

export function createDebitoriRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const result = await listDebitori(cfg.db, {
        tenantId: req.tenant!.tenantId,
        filter: req.body?.filter,
        skip: req.body?.skip,
        take: req.body?.take,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/ids-by-cf", resolveTenant, async (req, res, next) => {
    try {
      const variants = Array.isArray(req.body?.variants) ? req.body.variants.map(String) : [];
      const rows = await idsByCodiceFiscale(cfg.db, req.tenant!.tenantId, variants);
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  });

  router.post("/recapiti/count", resolveTenant, async (req, res, next) => {
    try {
      const total = await countRecapiti(cfg.db, String(req.body?.debitoreId), req.body?.tipo);
      res.json({ total });
    } catch (err) {
      next(err);
    }
  });

  router.post("/recapiti/find-first", resolveTenant, async (req, res, next) => {
    try {
      const item = await findFirstRecapito(cfg.db, req.body ?? {});
      res.json({ item: item ?? null });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/recapiti/:recapitoId", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateRecapito(cfg.db, req.params.recapitoId, req.body ?? {});
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
      await deleteRecapito(cfg.db, req.params.recapitoId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createDebitore(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", resolveTenant, async (req, res, next) => {
    try {
      const row = await getDebitoreById(cfg.db, req.tenant!.tenantId, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Debitore non trovato" });
        return;
      }
      res.json({ item: row });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateDebitore(cfg.db, req.tenant!.tenantId, req.params.id, req.body ?? {});
      if (!item) {
        res.status(404).json({ error: "Debitore non trovato" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", resolveTenant, async (req, res, next) => {
    try {
      await deleteDebitore(cfg.db, req.tenant!.tenantId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/recapiti", resolveTenant, async (req, res, next) => {
    try {
      const debitore = await getDebitoreById(cfg.db, req.tenant!.tenantId, req.params.id);
      if (!debitore) {
        res.status(404).json({ error: "Debitore non trovato" });
        return;
      }
      const items = await listRecapiti(cfg.db, req.params.id);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/recapiti", resolveTenant, async (req, res, next) => {
    try {
      const debitore = await getDebitoreById(cfg.db, req.tenant!.tenantId, req.params.id);
      if (!debitore) {
        res.status(404).json({ error: "Debitore non trovato" });
        return;
      }
      const body = req.body ?? {};
      const item = await createRecapito(cfg.db, {
        debitoreId: req.params.id,
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

  router.delete("/:id/recapiti", resolveTenant, async (req, res, next) => {
    try {
      const debitore = await getDebitoreById(cfg.db, req.tenant!.tenantId, req.params.id);
      if (!debitore) {
        res.status(404).json({ error: "Debitore non trovato" });
        return;
      }
      await deleteRecapitiByDebitore(cfg.db, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
