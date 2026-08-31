import { Router } from "express";
import { createTenantResolver } from "../middleware/tenant.js";
import { completeImpegnoAgenda, createImpegnoAgenda, deleteImpegnoAgenda, getImpegnoAgendaById, listImpegniAgenda, updateImpegnoAgenda, } from "../services/impegniAgendaService.js";
export function createImpegniAgendaRouter(cfg) {
    const router = Router({ mergeParams: true });
    const resolveTenant = createTenantResolver(cfg);
    router.post("/list", resolveTenant, async (req, res, next) => {
        try {
            const items = await listImpegniAgenda(cfg.db, req.tenant.tenantId, req.body?.filter, req.body?.take ?? 200);
            res.json({ items });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/:id", resolveTenant, async (req, res, next) => {
        try {
            const item = await getImpegnoAgendaById(cfg.db, req.tenant.tenantId, String(req.params.id));
            if (!item) {
                res.status(404).json({ error: "Impegno non trovato" });
                return;
            }
            res.json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/", resolveTenant, async (req, res, next) => {
        try {
            const item = await createImpegnoAgenda(cfg.db, req.tenant.tenantId, req.body);
            res.status(201).json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.patch("/:id", resolveTenant, async (req, res, next) => {
        try {
            const userId = String(req.body?.userId || "");
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            const item = await updateImpegnoAgenda(cfg.db, req.tenant.tenantId, String(req.params.id), userId, req.body?.data ?? req.body);
            res.json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/:id/complete", resolveTenant, async (req, res, next) => {
        try {
            const userId = String(req.body?.userId || "");
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            await completeImpegnoAgenda(cfg.db, req.tenant.tenantId, String(req.params.id), userId);
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.delete("/:id", resolveTenant, async (req, res, next) => {
        try {
            const userId = String(req.body?.userId || req.query?.userId || "");
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            await deleteImpegnoAgenda(cfg.db, req.tenant.tenantId, String(req.params.id), userId);
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
