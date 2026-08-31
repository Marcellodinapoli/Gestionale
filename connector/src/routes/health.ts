import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { pingDb } from "../db/pool.js";

export function createHealthRouter(cfg: ConnectorConfig) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "credixa-connector", ts: new Date().toISOString() });
  });

  router.get("/health/db", async (_req, res) => {
    try {
      const result = await pingDb(cfg.db);
      res.json({ status: "ok", database: cfg.db.database, latencyMs: result.ms });
    } catch (err) {
      res.status(503).json({
        status: "error",
        database: cfg.db.database,
        message: err instanceof Error ? err.message : "DB non raggiungibile",
      });
    }
  });

  return router;
}
