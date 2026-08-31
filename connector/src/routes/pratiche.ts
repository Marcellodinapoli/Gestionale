import { Router } from "express";

import type { ConnectorConfig } from "../config.js";

import { createTenantResolver } from "../middleware/tenant.js";

import {

  assignPratica,

  canAccessPraticaSql,

  countPratiche,

  createPratica,

  deletePratica,

  getPraticaById,

  getPraticaRelations,

  groupByNumeroMandante,

  idsAffidoTemporaneo,

  idsImportoTotale,

  idsTotIncassato,

  listPratiche,

  nextNumeroPratica,

  searchPratiche,

  updatePratica,

  updateStatoPratica,

} from "../services/praticheService.js";



export function createPraticheRouter(cfg: ConnectorConfig) {

  const router = Router({ mergeParams: true });

  const resolveTenant = createTenantResolver(cfg);



  router.get("/next-numero", resolveTenant, async (req, res, next) => {

    try {

      const numero = await nextNumeroPratica(cfg.db, req.tenant!.tenantId);

      res.json({ numero });

    } catch (err) {

      next(err);

    }

  });



  router.post("/list", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const scope = {

        tenantId: req.tenant!.tenantId,

        role: String(body.scope?.role || "ADMIN"),

        userId: String(body.scope?.userId || ""),

        memberIds: Array.isArray(body.scope?.memberIds) ? body.scope.memberIds.map(String) : undefined,

      };

      const result = await listPratiche(cfg.db, {

        scope,

        filter: body.filter,

        sortField: body.sort?.field,

        sortDir: body.sort?.dir,

        page: body.page,

        pageSize: body.pageSize,

        skip: body.skip,

        take: body.take,

      });



      if (Array.isArray(body.include) && body.include.length) {

        const enriched = await Promise.all(

          result.items.map(async (item) => {

            const rel = await getPraticaRelations(cfg.db, req.tenant!.tenantId, String(item.Id), body.include);

            return { ...item, ...rel };

          })

        );

        res.json({ ...result, items: enriched });

        return;

      }

      res.json(result);

    } catch (err) {

      next(err);

    }

  });



  router.post("/count", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const scope = {

        tenantId: req.tenant!.tenantId,

        role: String(body.scope?.role || "ADMIN"),

        userId: String(body.scope?.userId || ""),

        memberIds: Array.isArray(body.scope?.memberIds) ? body.scope.memberIds.map(String) : undefined,

      };

      const total = await countPratiche(cfg.db, { scope, filter: body.filter });

      res.json({ total });

    } catch (err) {

      next(err);

    }

  });



  router.post("/group-by-lotti", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const scope = {

        tenantId: req.tenant!.tenantId,

        role: String(body.scope?.role || "ADMIN"),

        userId: String(body.scope?.userId || ""),

        memberIds: Array.isArray(body.scope?.memberIds) ? body.scope.memberIds.map(String) : undefined,

      };

      const rows = await groupByNumeroMandante(cfg.db, scope, body.filter);

      res.json({ items: rows });

    } catch (err) {

      next(err);

    }

  });



  router.post("/ids-affido-temporaneo", resolveTenant, async (req, res, next) => {

    try {

      const ids = await idsAffidoTemporaneo(cfg.db, req.tenant!.tenantId);

      res.json({ ids });

    } catch (err) {

      next(err);

    }

  });



  router.post("/ids-importo-totale", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const ids = await idsImportoTotale(

        cfg.db,

        req.tenant!.tenantId,

        body.da != null ? Number(body.da) : undefined,

        body.a != null ? Number(body.a) : undefined

      );

      res.json({ ids });

    } catch (err) {

      next(err);

    }

  });



  router.post("/ids-tot-incassato", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const ids = await idsTotIncassato(

        cfg.db,

        req.tenant!.tenantId,

        body.da != null ? Number(body.da) : undefined,

        body.a != null ? Number(body.a) : undefined

      );

      res.json({ ids });

    } catch (err) {

      next(err);

    }

  });



  router.post("/can-access", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const scope = {

        tenantId: req.tenant!.tenantId,

        role: String(body.scope?.role || "ADMIN"),

        userId: String(body.scope?.userId || ""),

        memberIds: Array.isArray(body.scope?.memberIds) ? body.scope.memberIds.map(String) : undefined,

      };

      const ok = await canAccessPraticaSql(

        cfg.db,

        scope,

        String(body.praticaId || ""),

        Array.isArray(body.linkedIds) ? body.linkedIds.map(String) : undefined

      );

      res.json({ ok });

    } catch (err) {

      next(err);

    }

  });



  router.post("/", resolveTenant, async (req, res, next) => {

    try {

      const item = await createPratica(cfg.db, {

        ...req.body,

        tenantId: req.tenant!.tenantId,

      });

      res.status(201).json({ item });

    } catch (err) {

      next(err);

    }

  });



  router.post("/search", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const page = Math.max(1, Number(body.page) || 1);

      const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 25));

      const result = await searchPratiche(cfg.db, {

        tenantId: req.tenant!.tenantId,

        stato: body.stato ? String(body.stato) : undefined,

        mandanteId: body.mandanteId ? String(body.mandanteId) : undefined,

        assegnatarioId: body.assegnatarioId ? String(body.assegnatarioId) : undefined,

        q: body.q ? String(body.q) : undefined,

        page,

        pageSize,

      });

      res.json(result);

    } catch (err) {

      next(err);

    }

  });



  router.get("/:id", resolveTenant, async (req, res, next) => {

    try {

      const start = performance.now();

      const row = await getPraticaById(cfg.db, req.tenant!.tenantId, req.params.id);

      if (!row) {

        res.status(404).json({ error: "Pratica non trovata" });

        return;

      }

      const include = String(req.query.include || "")

        .split(",")

        .map((s) => s.trim())

        .filter(Boolean);

      let rel = {};

      if (include.length) {

        rel = await getPraticaRelations(cfg.db, req.tenant!.tenantId, req.params.id, include);

      }

      res.json({ item: { ...row, ...rel }, queryMs: Math.round(performance.now() - start) });

    } catch (err) {

      next(err);

    }

  });



  router.patch("/:id", resolveTenant, async (req, res, next) => {

    try {

      const item = await updatePratica(cfg.db, req.tenant!.tenantId, req.params.id, req.body ?? {});

      if (!item) {

        res.status(404).json({ error: "Pratica non trovata" });

        return;

      }

      res.json({ item });

    } catch (err) {

      next(err);

    }

  });



  router.delete("/:id", resolveTenant, async (req, res, next) => {

    try {

      await deletePratica(cfg.db, req.tenant!.tenantId, req.params.id);

      res.status(204).send();

    } catch (err) {

      next(err);

    }

  });



  router.post("/:id/assign", resolveTenant, async (req, res, next) => {

    try {

      const item = await assignPratica(cfg.db, req.tenant!.tenantId, req.params.id, req.body ?? {});

      res.json({ item });

    } catch (err) {

      next(err);

    }

  });



  router.post("/:id/stato", resolveTenant, async (req, res, next) => {

    try {

      const body = req.body ?? {};

      const item = await updateStatoPratica(

        cfg.db,

        req.tenant!.tenantId,

        req.params.id,

        String(body.stato || ""),

        body.promessaAt ? new Date(body.promessaAt) : body.promessaAt === null ? null : undefined

      );

      res.json({ item });

    } catch (err) {

      next(err);

    }

  });



  return router;

}


