import { Router } from "express";
import { createTenantResolver } from "../middleware/tenant.js";
import { aggregateIncassi, countIncassi, getIncassoById, groupByMetodoIncassi, listIncassi, registraIncasso, } from "../services/incassiService.js";
export function createIncassiRouter(cfg) {
    const router = Router({ mergeParams: true });
    const resolveTenant = createTenantResolver(cfg);
    router.post("/list", resolveTenant, async (req, res, next) => {
        try {
            const result = await listIncassi(cfg.db, {
                tenantId: req.tenant.tenantId,
                filter: req.body?.filter,
                skip: req.body?.skip,
                take: req.body?.take,
                includePratica: Boolean(req.body?.includePratica),
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/count", resolveTenant, async (req, res, next) => {
        try {
            const total = await countIncassi(cfg.db, req.tenant.tenantId, req.body?.filter);
            res.json({ total });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/aggregate", resolveTenant, async (req, res, next) => {
        try {
            const result = await aggregateIncassi(cfg.db, req.tenant.tenantId, req.body?.filter);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/group-by-metodo", resolveTenant, async (req, res, next) => {
        try {
            const items = await groupByMetodoIncassi(cfg.db, req.tenant.tenantId, req.body?.filter);
            res.json({ items });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/registra", resolveTenant, async (req, res, next) => {
        try {
            const item = await registraIncasso(cfg.db, req.tenant.tenantId, req.body);
            res.status(201).json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/:id", resolveTenant, async (req, res, next) => {
        try {
            const item = await getIncassoById(cfg.db, req.tenant.tenantId, String(req.params.id));
            if (!item) {
                res.status(404).json({ error: "Incasso non trovato" });
                return;
            }
            res.json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
