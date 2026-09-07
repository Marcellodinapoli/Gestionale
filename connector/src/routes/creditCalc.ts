import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  getCreditCalcProfile,
  getPraticaCreditCalc,
  listPraticheAffidateCreditCalc,
  lavorazioneCreditCalc,
  loginCreditCalc,
} from "../services/creditCalcService.js";

function statusOf(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    const s = Number((err as { status: unknown }).status);
    if (s >= 400 && s < 600) return s;
  }
  return 500;
}

export function createCreditCalcRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  /** Login consulente (email + password gestionale). */
  router.post("/login", async (req, res, next) => {
    try {
      const tenantSlug =
        String(req.body?.tenantSlug || req.params.tenantId || "").trim() ||
        "demo";
      const data = await loginCreditCalc(cfg, {
        tenantSlug,
        email: String(req.body?.email || ""),
        password: String(req.body?.password || ""),
      });
      res.json(data);
    } catch (err) {
      const status = statusOf(err);
      if (status < 500) {
        res.status(status).json({ error: err instanceof Error ? err.message : "Errore" });
        return;
      }
      next(err);
    }
  });

  /** Profilo consulente (verifica abilitazione CreditCalc). */
  router.post("/session", resolveTenant, async (req, res, next) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      if (!userId) {
        res.status(400).json({ error: "userId obbligatorio" });
        return;
      }
      const profile = await getCreditCalcProfile(cfg.db, req.tenant!.tenantId, userId);
      res.json({ profile });
    } catch (err) {
      const status = statusOf(err);
      if (status < 500) {
        res.status(status).json({ error: err instanceof Error ? err.message : "Errore" });
        return;
      }
      next(err);
    }
  });

  /** Elenco pratiche in affido al consulente. */
  router.post("/pratiche", resolveTenant, async (req, res, next) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      if (!userId) {
        res.status(400).json({ error: "userId obbligatorio" });
        return;
      }
      const data = await listPraticheAffidateCreditCalc(
        cfg.db,
        req.tenant!.tenantId,
        userId,
        { take: req.body?.take, skip: req.body?.skip }
      );
      res.json(data);
    } catch (err) {
      const status = statusOf(err);
      if (status < 500) {
        res.status(status).json({ error: err instanceof Error ? err.message : "Errore" });
        return;
      }
      next(err);
    }
  });

  /** Dettaglio pratica (solo se in affido). */
  router.post("/pratiche/:id", resolveTenant, async (req, res, next) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      const praticaId = String(req.params.id || "").trim();
      if (!userId || !praticaId) {
        res.status(400).json({ error: "userId e id pratica obbligatori" });
        return;
      }
      const data = await getPraticaCreditCalc(
        cfg.db,
        req.tenant!.tenantId,
        userId,
        praticaId
      );
      res.json(data);
    } catch (err) {
      const status = statusOf(err);
      if (status < 500) {
        res.status(status).json({ error: err instanceof Error ? err.message : "Errore" });
        return;
      }
      next(err);
    }
  });

  /** Nota e/o codice scarico (mobile CreditCalc). */
  router.post("/pratiche/:id/lavorazione", resolveTenant, async (req, res, next) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      const praticaId = String(req.params.id || "").trim();
      if (!userId || !praticaId) {
        res.status(400).json({ error: "userId e id pratica obbligatori" });
        return;
      }
      const data = await lavorazioneCreditCalc(
        cfg.db,
        req.tenant!.tenantId,
        userId,
        praticaId,
        {
          nota: req.body?.nota,
          codiceScarico: req.body?.codiceScarico,
        }
      );
      res.json(data);
    } catch (err) {
      const status = statusOf(err);
      if (status < 500) {
        res.status(status).json({ error: err instanceof Error ? err.message : "Errore" });
        return;
      }
      next(err);
    }
  });

  return router;
}
