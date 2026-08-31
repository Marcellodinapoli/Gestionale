import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  loadAgendaCalendario,
  loadAgendaGiorno,
  loadMemoAlertsBundle,
  listMessaggiAgendaScoped,
} from "../services/agendaService.js";

export function createAgendaRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/calendario", resolveTenant, async (req, res, next) => {
    try {
      const bundle = await loadAgendaCalendario(cfg.db, {
        tenantId: req.tenant!.tenantId,
        ...req.body,
      });
      res.json(bundle);
    } catch (err) {
      next(err);
    }
  });

  router.post("/giorno", resolveTenant, async (req, res, next) => {
    try {
      const bundle = await loadAgendaGiorno(cfg.db, {
        tenantId: req.tenant!.tenantId,
        ...req.body,
      });
      res.json(bundle);
    } catch (err) {
      next(err);
    }
  });

  router.post("/memo-alerts", resolveTenant, async (req, res, next) => {
    try {
      const bundle = await loadMemoAlertsBundle(cfg.db, {
        tenantId: req.tenant!.tenantId,
        ...req.body,
      });
      res.json(bundle);
    } catch (err) {
      next(err);
    }
  });

  router.post("/messaggi-agenda", resolveTenant, async (req, res, next) => {
    try {
      const items = await listMessaggiAgendaScoped(cfg.db, {
        tenantId: req.tenant!.tenantId,
        ...req.body,
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
