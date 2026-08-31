import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  countUsers,
  createUser,
  getUserByEmail,
  getUserById,
  listUsers,
  updateManyUsers,
  updateUser,
} from "../services/usersAdminService.js";

export function createUsersRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.post("/list", resolveTenant, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const result = await listUsers(cfg.db, req.tenant!.tenantId, body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/count", resolveTenant, async (req, res, next) => {
    try {
      const total = await countUsers(cfg.db, req.tenant!.tenantId, req.body?.filter);
      res.json({ total });
    } catch (err) {
      next(err);
    }
  });

  router.post("/by-email", resolveTenant, async (req, res, next) => {
    try {
      const email = String(req.body?.email || "").trim();
      if (!email) {
        res.status(400).json({ error: "email obbligatoria" });
        return;
      }
      const item = await getUserByEmail(cfg.db, req.tenant!.tenantId, email, req.body?.include);
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", resolveTenant, async (req, res, next) => {
    try {
      const include = req.query.include
        ? (JSON.parse(String(req.query.include)) as import("../services/usersAdminService.js").UserInclude)
        : undefined;
      const item = await getUserById(cfg.db, req.tenant!.tenantId, String(req.params.id), include);
      if (!item) {
        res.status(404).json({ error: "Utente non trovato" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", resolveTenant, async (req, res, next) => {
    try {
      const item = await createUser(cfg.db, req.tenant!.tenantId, req.body ?? {});
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", resolveTenant, async (req, res, next) => {
    try {
      const item = await updateUser(cfg.db, req.tenant!.tenantId, String(req.params.id), req.body ?? {});
      if (!item) {
        res.status(404).json({ error: "Utente non trovato" });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/update-many", resolveTenant, async (req, res, next) => {
    try {
      const result = await updateManyUsers(
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

  return router;
}
