import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  deleteMessaggiAgendaByPratica,
  findOpenMessaggioAgenda,
  getMessaggioAgendaById,
  listMessaggiAgenda,
  markMessaggioAgendaLetto,
  markMessaggiAgendaPraticaLetti,
  upsertOpenMessaggioAgenda,
} from "../services/messaggiAgendaService.js";

export function createMessaggiAgendaRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const items = await listMessaggiAgenda(
        cfg.db,
        req.tenant!.tenantId,
        req.body?.filter,
        req.body?.take ?? 100
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.get("/open/:praticaId", resolveTenant, async (req, res, next) => {
    try {
      const item = await findOpenMessaggioAgenda(
        cfg.db,
        req.tenant!.tenantId,
        String(req.params.praticaId)
      );
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await getMessaggioAgendaById(
        cfg.db,
        req.tenant!.tenantId,
        String(req.params.id)
      );
      if (!item) {
        res.status(404).json({ error: "Messaggio non trovato" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/upsert-open", resolveTenant, async (req, res, next) => {
    try {
      await upsertOpenMessaggioAgenda(cfg.db, req.tenant!.tenantId, req.body);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/letto", resolveTenant, async (req, res, next) => {
    try {
      await markMessaggioAgendaLetto(cfg.db, req.tenant!.tenantId, String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/pratica/:praticaId/letti", resolveTenant, async (req, res, next) => {
    try {
      await markMessaggiAgendaPraticaLetti(
        cfg.db,
        req.tenant!.tenantId,
        String(req.params.praticaId)
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/pratica/:praticaId", resolveTenant, async (req, res, next) => {
    try {
      await deleteMessaggiAgendaByPratica(
        cfg.db,
        req.tenant!.tenantId,
        String(req.params.praticaId)
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
