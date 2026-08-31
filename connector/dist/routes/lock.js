import { Router } from "express";
import { createTenantResolver } from "../middleware/tenant.js";
import { acquireLock, getLockStatus, releaseLock, releaseAllUserLocks, releaseLockForPratica, renewLock, findActiveLocksByPraticaIds, LOCK_TTL_SEC, } from "../services/lockService.js";
const STREAM_POLL_MS = 5_000;
function requireUserId(req) {
    const userId = String(req.body?.userId || req.query?.userId || "").trim();
    return userId || null;
}
function writeSse(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function statusJson(status) {
    return {
        owned: status.owned,
        lockedByName: status.lockedBy?.name ?? null,
        lockedBy: status.lockedBy,
    };
}
export function createLockRouter(cfg) {
    const router = Router({ mergeParams: true });
    const resolveTenant = createTenantResolver(cfg);
    router.post("/locks/active", resolveTenant, async (req, res, next) => {
        try {
            const ids = Array.isArray(req.body?.praticaIds) ? req.body.praticaIds.map(String) : [];
            const locks = await findActiveLocksByPraticaIds(cfg.db, req.tenant.tenantId, ids);
            res.json({ locks });
        }
        catch (err) {
            next(err);
        }
    });
    router.delete("/locks/user", resolveTenant, async (req, res, next) => {
        try {
            const userId = requireUserId(req);
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            await releaseAllUserLocks(cfg.db, req.tenant.tenantId, userId);
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/:id/lock/stream", resolveTenant, async (req, res, next) => {
        try {
            const userId = requireUserId(req);
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            const tenantId = req.tenant.tenantId;
            const praticaId = req.params.id;
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache, no-transform");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders?.();
            let lastPayload = "";
            let closed = false;
            const poll = async () => {
                if (closed)
                    return;
                try {
                    const status = await getLockStatus(cfg.db, tenantId, praticaId, userId);
                    const payload = JSON.stringify({
                        owned: status.owned,
                        lockedByName: status.lockedBy?.name ?? null,
                    });
                    if (payload !== lastPayload) {
                        lastPayload = payload;
                        writeSse(res, "lock", JSON.parse(payload));
                    }
                    else {
                        res.write(`: ping ${Date.now()}\n\n`);
                    }
                }
                catch {
                    writeSse(res, "error", { message: "poll failed" });
                }
            };
            await poll();
            const timer = setInterval(poll, STREAM_POLL_MS);
            req.on("close", () => {
                closed = true;
                clearInterval(timer);
            });
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/:id/lock/acquire", resolveTenant, async (req, res, next) => {
        try {
            const userId = requireUserId(req);
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            const status = await acquireLock(cfg.db, req.tenant.tenantId, req.params.id, userId);
            res.json(statusJson(status));
        }
        catch (err) {
            next(err);
        }
    });
    router.post("/:id/lock", resolveTenant, async (req, res, next) => {
        try {
            const userId = requireUserId(req);
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            const status = await renewLock(cfg.db, req.tenant.tenantId, req.params.id, userId);
            res.json(statusJson(status));
        }
        catch (err) {
            next(err);
        }
    });
    router.delete("/:id/lock", resolveTenant, async (req, res, next) => {
        try {
            const userId = requireUserId(req);
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            await releaseLock(cfg.db, req.tenant.tenantId, req.params.id, userId);
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.delete("/:id/lock/pratica", resolveTenant, async (req, res, next) => {
        try {
            await releaseLockForPratica(cfg.db, req.tenant.tenantId, req.params.id);
            res.json({ ok: true });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/:id/lock", resolveTenant, async (req, res, next) => {
        try {
            const userId = requireUserId(req);
            if (!userId) {
                res.status(400).json({ error: "userId richiesto" });
                return;
            }
            const status = await getLockStatus(cfg.db, req.tenant.tenantId, req.params.id, userId);
            res.json(statusJson(status));
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
export { LOCK_TTL_SEC };
