import { Router } from "express";
import { createTenantResolver } from "../middleware/tenant.js";
import { countPraticheImportBatch, createImportBatch, deleteImportBatch, findImportBatchByLotKey, getImportBatchById, linkPraticheToImportBatch, listImportBatches, updateImportBatch, } from "../services/importBatchService.js";
import { processImportPraticheChunk } from "../services/importPraticheService.js";
export function createImportBatchRouter(cfg) {
    const router = Router({ mergeParams: true });
    const resolveTenant = createTenantResolver(cfg);
    router.post("/list", resolveTenant, async (req, res, next) => {
        try {
            const items = await listImportBatches(cfg.db, req.tenant.tenantId, req.body);
            res.json({ items });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/find-by-lot", resolveTenant, async (req, res, next) => {
        try {
            const item = await findImportBatchByLotKey(cfg.db, req.tenant.tenantId, req.body);
            res.json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/:id", resolveTenant, async (req, res, next) => {
        try {
            const item = await getImportBatchById(cfg.db, req.tenant.tenantId, String(req.params.id));
            if (!item) {
                res.status(404).json({ error: "ImportBatch non trovato" });
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
            const item = await createImportBatch(cfg.db, req.tenant.tenantId, req.body);
            res.status(201).json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.patch("/:id", resolveTenant, async (req, res, next) => {
        try {
            const item = await updateImportBatch(cfg.db, req.tenant.tenantId, String(req.params.id), req.body);
            res.json({ item });
        }
        catch (err) {
            next(err);
        }
    });
    router.delete("/:id", resolveTenant, async (req, res, next) => {
        try {
            await deleteImportBatch(cfg.db, req.tenant.tenantId, String(req.params.id));
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/:id/link-pratiche", resolveTenant, async (req, res, next) => {
        try {
            const result = await linkPraticheToImportBatch(cfg.db, req.tenant.tenantId, {
                batchId: String(req.params.id),
                ...req.body,
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/count-pratiche", resolveTenant, async (req, res, next) => {
        try {
            const total = await countPraticheImportBatch(cfg.db, req.tenant.tenantId, req.body);
            res.json({ total });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/process-chunk", resolveTenant, async (req, res, next) => {
        try {
            const result = await processImportPraticheChunk(cfg.db, req.tenant.tenantId, {
                creates: req.body?.creates ?? [],
                updates: req.body?.updates ?? [],
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
