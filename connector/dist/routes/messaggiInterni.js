import { Router } from "express";
import { createTenantResolver } from "../middleware/tenant.js";
import { createMessaggiInterni, deleteMessaggioInterno, deleteMessaggiInterniByPratica, getMessaggioInternoById, listMessaggiInterni, updateMessaggioInternoLetto, updateMessaggioInternoTesto, } from "../services/messaggiInterniService.js";
export function createMessaggiInterniRouter(cfg) {
    const router = Router({ mergeParams: true });
    const resolveTenant = createTenantResolver(cfg);
    router.post("/list", resolveTenant, async (req, res, next) => {
        try {
            const items = await listMessaggiInterni(cfg.db, req.tenant.tenantId, req.body?.filter, req.body?.take ?? 100);
            res.json({ items });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/:id", resolveTenant, async (req, res, next) => {
        try {
            const item = await getMessaggioInternoById(cfg.db, req.tenant.tenantId, String(req.params.id));
            if (!item) {
                res.status(404).json({ error: "Messaggio non trovato" });
                return;
            }
            res.json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/create-many", resolveTenant, async (req, res, next) => {
        try {
            await createMessaggiInterni(cfg.db, req.tenant.tenantId, req.body?.items ?? []);
            res.status(201).json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/:id/letto", resolveTenant, async (req, res, next) => {
        try {
            await updateMessaggioInternoLetto(cfg.db, req.tenant.tenantId, String(req.params.id), Boolean(req.body?.letto ?? true));
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.patch("/:id", resolveTenant, async (req, res, next) => {
        try {
            await updateMessaggioInternoTesto(cfg.db, req.tenant.tenantId, String(req.params.id), String(req.body?.testo ?? ""));
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.delete("/:id", resolveTenant, async (req, res, next) => {
        try {
            await deleteMessaggioInterno(cfg.db, req.tenant.tenantId, String(req.params.id));
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.delete("/pratica/:praticaId", resolveTenant, async (req, res, next) => {
        try {
            await deleteMessaggiInterniByPratica(cfg.db, req.tenant.tenantId, String(req.params.praticaId));
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
