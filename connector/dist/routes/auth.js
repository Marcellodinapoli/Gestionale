import { Router } from "express";
import { getPostazioneActive, getTenantBySlug, getUserByEmail, getUserById, getUserSession, updateUserLogin, } from "../services/usersService.js";
export function createAuthRouter(cfg) {
    const router = Router();
    router.get("/:tenantSlug/auth/tenant", async (req, res, next) => {
        try {
            const slug = String(req.params.tenantSlug || "").trim().toLowerCase();
            const tenant = await getTenantBySlug(cfg, slug);
            if (!tenant) {
                res.status(404).json({ tenant: null });
                return;
            }
            res.json({ tenant });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
export function createInternalRouter(cfg) {
    const router = Router();
    router.post("/users/by-email", async (req, res, next) => {
        try {
            const tenantId = String(req.body?.tenantId || "");
            const email = String(req.body?.email || "").trim().toLowerCase();
            if (!tenantId || !email) {
                res.status(400).json({ error: "tenantId e email obbligatori" });
                return;
            }
            const user = await getUserByEmail(cfg, tenantId, email);
            res.json({ user: user ?? null });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/users/:userId/session", async (req, res, next) => {
        try {
            const tenantId = String(req.query.tenantId || "");
            const userId = String(req.params.userId || "");
            if (!tenantId || !userId) {
                res.status(400).json({ error: "tenantId e userId obbligatori" });
                return;
            }
            const user = await getUserSession(cfg, tenantId, userId);
            res.json({ user: user ?? null });
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/users/:userId", async (req, res, next) => {
        try {
            const tenantId = String(req.query.tenantId || "");
            const userId = String(req.params.userId || "");
            if (!tenantId || !userId) {
                res.status(400).json({ error: "tenantId e userId obbligatori" });
                return;
            }
            const user = await getUserById(cfg, tenantId, userId);
            res.json({ user: user ?? null });
        }
        catch (err) {
            next(err);
        }
    });
    router.patch("/users/:userId/login", async (req, res, next) => {
        try {
            const userId = String(req.params.userId || "");
            const lastLoginAt = String(req.body?.lastLoginAt || "");
            if (!userId || !lastLoginAt) {
                res.status(400).json({ error: "userId e lastLoginAt obbligatori" });
                return;
            }
            await updateUserLogin(cfg, userId, {
                lastLoginAt,
                postazioneId: req.body?.postazioneId ?? undefined,
                postazioneFissa: req.body?.postazioneFissa,
            });
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    });
    router.get("/postazioni/:postazioneId", async (req, res, next) => {
        try {
            const tenantId = String(req.query.tenantId || "");
            const postazioneId = String(req.params.postazioneId || "");
            if (!tenantId || !postazioneId) {
                res.status(400).json({ error: "tenantId e postazioneId obbligatori" });
                return;
            }
            const postazione = await getPostazioneActive(cfg, tenantId, postazioneId);
            res.json({ postazione: postazione ?? null });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
