import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { randomUUID } from "node:crypto";
import {
  authenticateCredixaRequest,
  authenticateSourceRequest,
  type AuthConfig,
} from "./auth.js";
import { logEvent } from "./log.js";
import { toReceiverCandidateDto } from "./models.js";
import { validateCvUpload } from "./source/cvValidate.js";
import { validateIngestBody } from "./source/ingestValidate.js";
import type { ApplicationStore } from "./store/applicationStore.js";
import type { LocalDocumentStorage } from "./storage/localDocumentStorage.js";
import { pushApplicationToCredixa } from "./credixaPush.js";

export type AppDeps = {
  store: ApplicationStore;
  storage: LocalDocumentStorage;
  auth: AuthConfig;
  sourceAuth: AuthConfig;
  cvOpenTtlSeconds?: number;
  maxCvSizeBytes?: number;
};

function headerMap(req: Request): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
}

function pathWithQuery(req: Request): string {
  return req.originalUrl || req.url;
}

function requireCredixaAuth(
  deps: AppDeps
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const pathTenantId = String(req.params.tenantId || "").trim();
    const headerTenant = String(
      req.header("x-credixa-tenant-id") || ""
    ).trim();
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? ""
          : req.method === "GET" || req.method === "HEAD"
            ? ""
            : JSON.stringify(req.body ?? {});

    const result = authenticateCredixaRequest({
      config: deps.auth,
      pathTenantId,
      headerTenantId: headerTenant,
      method: req.method,
      pathWithQuery: pathWithQuery(req),
      body: rawBody,
      headers: headerMap(req),
    });

    if (!result.ok) {
      logEvent("auth_failed", {
        eventId: randomUUID(),
        tenantId: pathTenantId || undefined,
        endpoint: pathWithQuery(req),
        status: result.status,
        outcome: result.code,
        authMode: deps.auth.mode,
      });
      res.status(result.status).json({ error: result.code });
      return;
    }

    next();
  };
}

function requireSourceAuth(
  deps: AppDeps,
  bodyForHmac: (req: Request) => string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const pathTenantId = String(req.params.tenantId || "").trim();
    const headerTenant = String(
      req.header("x-source-tenant-id") || ""
    ).trim();
    const result = authenticateSourceRequest({
      config: deps.sourceAuth,
      pathTenantId,
      headerTenantId: headerTenant,
      method: req.method,
      pathWithQuery: pathWithQuery(req),
      body: bodyForHmac(req),
      headers: headerMap(req),
    });
    if (!result.ok) {
      logEvent("source_auth_failed", {
        eventId: randomUUID(),
        tenantId: pathTenantId || undefined,
        endpoint: pathWithQuery(req),
        status: result.status,
        outcome: result.code,
        authMode: deps.sourceAuth.mode,
      });
      res.status(result.status).json({ error: result.code });
      return;
    }
    next();
  };
}

function assertNoForbiddenKeys(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  const banned = [
    "internalStorageRef",
    "base64",
    "resumeData",
    "local://",
    "file://",
  ];
  return !banned.some((b) => text.includes(b));
}

function fileNameFromHeaders(req: Request): string {
  const xName = String(req.header("x-file-name") || "").trim();
  if (xName) return xName.replace(/[/\\]/g, "");
  const cd = String(req.header("content-disposition") || "");
  const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
  if (m) return decodeURIComponent(m[1]!.replace(/"/g, "")).replace(/[/\\]/g, "");
  return "cv.pdf";
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  const credixaAuth = requireCredixaAuth(deps);
  const sourceJsonAuth = requireSourceAuth(deps, (req) =>
    typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {})
  );
  const sourceRawAuth = requireSourceAuth(deps, () => "");
  const ttl = deps.cvOpenTtlSeconds ?? 300;
  const maxCv = deps.maxCvSizeBytes ?? 5 * 1024 * 1024;

  // ---------- SOURCE: ingest ----------
  app.put(
    "/v1/tenants/:tenantId/applications/by-external/:externalApplicationId",
    sourceJsonAuth,
    (req, res) => {
      const tenantId = String(req.params.tenantId);
      const pathExt = String(req.params.externalApplicationId || "");
      const eventId = randomUUID();
      const validated = validateIngestBody(req.body, pathExt);
      if (!validated.ok) {
        logEvent("source_ingest", {
          eventId,
          tenantId,
          endpoint: pathWithQuery(req),
          status: validated.error.status,
          outcome: validated.error.code,
        });
        res.status(validated.error.status).json({
          error: validated.error.code,
          message: validated.error.message,
        });
        return;
      }

      const { value } = validated;
      const { record, created } = deps.store.upsertByExternal({
        tenantId,
        externalApplicationId: value.externalApplicationId,
        indeedJobId: value.indeedJobId,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        emailVerified: value.emailVerified,
        phone: value.phone,
        coverLetter: value.coverLetter,
        receivedAt: value.receivedAt,
        source: value.source,
        resumeHints: value.resumeMeta,
      });

      const dto = toReceiverCandidateDto(record);
      if (!assertNoForbiddenKeys(dto)) {
        res.status(500).json({ error: "INTERNAL" });
        return;
      }
      logEvent("source_ingest", {
        eventId,
        tenantId,
        receiverCandidateId: record.receiverCandidateId,
        documentId: record.resumeMeta?.documentId ?? undefined,
        endpoint: pathWithQuery(req),
        status: created ? 201 : 200,
        outcome: created ? "created" : "updated",
      });
      // Push istantaneo verso Credixa (best-effort, non blocca la risposta SOURCE)
      void pushApplicationToCredixa(tenantId, dto);
      res.status(created ? 201 : 200).json(dto);
    }
  );

  // ---------- SOURCE: lettura candidatura (per rivedi/modifica CreditCore) ----------
  app.get(
    "/v1/tenants/:tenantId/applications/by-external/:externalApplicationId",
    sourceRawAuth,
    (req, res) => {
      const tenantId = String(req.params.tenantId);
      const externalApplicationId = String(
        req.params.externalApplicationId || ""
      ).trim();
      const eventId = randomUUID();
      if (!externalApplicationId) {
        res.status(400).json({ error: "EXTERNAL_ID_REQUIRED" });
        return;
      }
      const appRec = deps.store.getByExternalId(
        tenantId,
        externalApplicationId
      );
      if (!appRec) {
        logEvent("source_get_application", {
          eventId,
          tenantId,
          endpoint: pathWithQuery(req),
          status: 404,
          outcome: "NOT_FOUND",
        });
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      const dto = toReceiverCandidateDto(appRec);
      if (!assertNoForbiddenKeys(dto)) {
        res.status(500).json({ error: "INTERNAL" });
        return;
      }
      logEvent("source_get_application", {
        eventId,
        tenantId,
        receiverCandidateId: appRec.receiverCandidateId,
        endpoint: pathWithQuery(req),
        status: 200,
        outcome: "ok",
      });
      res.status(200).json(dto);
    }
  );

  // ---------- SOURCE: CV upload (raw binary) ----------
  app.put(
    "/v1/tenants/:tenantId/applications/:receiverCandidateId/documents/:documentId",
    sourceRawAuth,
    express.raw({
      type: () => true,
      limit: maxCv + 1024,
    }),
    async (req, res) => {
      const tenantId = String(req.params.tenantId);
      const receiverCandidateId = String(req.params.receiverCandidateId);
      const documentId = String(req.params.documentId);
      const eventId = randomUUID();

      const ct = String(req.header("content-type") || "");
      if (/multipart\//i.test(ct) || /application\/json/i.test(ct)) {
        logEvent("source_cv_upload", {
          eventId,
          tenantId,
          receiverCandidateId,
          documentId,
          endpoint: pathWithQuery(req),
          status: 400,
          outcome: "UNSUPPORTED_CONTENT_TYPE",
        });
        res.status(400).json({
          error: "UNSUPPORTED_CONTENT_TYPE",
          message:
            "Inviare il file come body binario con Content-Type MIME del documento",
        });
        return;
      }

      const bytes = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body ?? []);

      // express.raw may throw PayloadTooLarge — also check size
      if (bytes.length > maxCv) {
        res.status(413).json({ error: "FILE_TOO_LARGE" });
        return;
      }

      const fileName = fileNameFromHeaders(req);
      const validated = validateCvUpload({
        bytes,
        contentType: ct,
        fileName,
        maxBytes: maxCv,
      });
      if (!validated.ok) {
        logEvent("source_cv_upload", {
          eventId,
          tenantId,
          receiverCandidateId,
          documentId,
          endpoint: pathWithQuery(req),
          status: validated.status,
          outcome: validated.code,
          contentType: ct || undefined,
          sizeBytes: bytes.length,
        });
        res.status(validated.status).json({
          error: validated.code,
          message: validated.message,
        });
        return;
      }

      const result = await deps.store.putDocument({
        tenantId,
        receiverCandidateId,
        documentId,
        fileName,
        contentType: validated.contentType,
        bytes,
      });
      if (!result.ok) {
        logEvent("source_cv_upload", {
          eventId,
          tenantId,
          receiverCandidateId,
          documentId,
          endpoint: pathWithQuery(req),
          status: result.status,
          outcome: result.code,
        });
        res.status(result.status).json({ error: result.code });
        return;
      }

      const appRec = deps.store.getByCandidateId(tenantId, receiverCandidateId)!;
      const dto = toReceiverCandidateDto(appRec);
      if (!assertNoForbiddenKeys(dto)) {
        res.status(500).json({ error: "INTERNAL" });
        return;
      }
      logEvent("source_cv_upload", {
        eventId,
        tenantId,
        receiverCandidateId,
        documentId: result.doc.documentId,
        endpoint: pathWithQuery(req),
        status: 200,
        outcome: "ok",
        contentType: result.doc.contentType,
        sizeBytes: result.doc.sizeBytes,
      });
      res.status(200).json({
        documentId: result.doc.documentId,
        cvRef: dto.cvRef,
        resumeMeta: dto.resumeMeta,
        application: dto,
      });
    }
  );

  // ---------- CREDIXA-FACING (invariati) ----------
  app.get(
    "/v1/tenants/:tenantId/applications",
    credixaAuth,
    (req, res) => {
      const tenantId = String(req.params.tenantId);
      const indeedJobId = String(req.query.indeedJobId || "").trim();
      const eventId = randomUUID();
      if (!indeedJobId) {
        res.status(400).json({ error: "indeedJobId_required" });
        return;
      }
      const list = deps.store
        .listByIndeedJobId(tenantId, indeedJobId)
        .map(toReceiverCandidateDto);
      if (!assertNoForbiddenKeys(list)) {
        res.status(500).json({ error: "INTERNAL" });
        return;
      }
      logEvent("list_applications", {
        eventId,
        tenantId,
        indeedJobId,
        endpoint: pathWithQuery(req),
        status: 200,
        outcome: "ok",
      });
      res.status(200).json(list);
    }
  );

  app.get(
    "/v1/tenants/:tenantId/applications/:receiverCandidateId",
    credixaAuth,
    (req, res) => {
      const tenantId = String(req.params.tenantId);
      const receiverCandidateId = String(req.params.receiverCandidateId);
      const eventId = randomUUID();
      const appRec = deps.store.getByCandidateId(
        tenantId,
        receiverCandidateId
      );
      if (!appRec) {
        logEvent("get_application", {
          eventId,
          tenantId,
          receiverCandidateId,
          endpoint: pathWithQuery(req),
          status: 404,
          outcome: "CANDIDATE_NOT_FOUND",
        });
        res.status(404).json({ error: "CANDIDATE_NOT_FOUND" });
        return;
      }
      const dto = toReceiverCandidateDto(appRec);
      if (!assertNoForbiddenKeys(dto)) {
        res.status(500).json({ error: "INTERNAL" });
        return;
      }
      logEvent("get_application", {
        eventId,
        tenantId,
        receiverCandidateId,
        endpoint: pathWithQuery(req),
        status: 200,
        outcome: "ok",
      });
      res.status(200).json(dto);
    }
  );

  app.post(
    "/v1/tenants/:tenantId/applications/:receiverCandidateId/cv-open",
    credixaAuth,
    async (req, res) => {
      const tenantId = String(req.params.tenantId);
      const receiverCandidateId = String(req.params.receiverCandidateId);
      const eventId = randomUUID();

      const doc = deps.store.getDocumentForCandidate(
        tenantId,
        receiverCandidateId
      );
      if (!doc) {
        logEvent("cv_open", {
          eventId,
          tenantId,
          receiverCandidateId,
          endpoint: pathWithQuery(req),
          status: 404,
          outcome: "CV_UNAVAILABLE",
        });
        res.status(404).json({ error: "CV_UNAVAILABLE" });
        return;
      }

      const exists = await deps.storage.exists(doc.internalStorageRef);
      if (!exists) {
        logEvent("cv_open", {
          eventId,
          tenantId,
          receiverCandidateId,
          documentId: doc.documentId,
          endpoint: pathWithQuery(req),
          status: 404,
          outcome: "CV_UNAVAILABLE",
        });
        res.status(404).json({ error: "CV_UNAVAILABLE" });
        return;
      }

      const access = await deps.storage.createTemporaryAccess({
        tenantId,
        documentId: doc.documentId,
        internalStorageRef: doc.internalStorageRef,
        contentType: doc.contentType,
        fileName: doc.fileName,
        ttlSeconds: ttl,
      });

      logEvent("cv_open", {
        eventId,
        tenantId,
        receiverCandidateId,
        documentId: doc.documentId,
        contentType: doc.contentType,
        sizeBytes: doc.sizeBytes,
        endpoint: pathWithQuery(req),
        status: 200,
        outcome: "ok",
      });
      res.status(200).json({
        openUrl: access.openUrl,
        expiresAt: access.expiresAt,
        fileName: doc.fileName || null,
        contentType: doc.contentType || null,
      });
    }
  );

  app.get(
    "/v1/tenants/:tenantId/sync-status",
    credixaAuth,
    (req, res) => {
      const tenantId = String(req.params.tenantId);
      const status = deps.store.syncStatus(tenantId);
      logEvent("sync_status", {
        eventId: randomUUID(),
        tenantId,
        endpoint: pathWithQuery(req),
        status: 200,
        outcome: "ok",
      });
      res.status(200).json({
        ok: status.ok,
        lastSyncAt: status.lastSyncAt,
        pendingCount: status.pendingCount,
      });
    }
  );

  app.get("/v1/tmp/:token", async (req, res) => {
    const token = decodeURIComponent(String(req.params.token || ""));
    const payload = deps.storage.verifyTemporaryToken(token);
    if (!payload) {
      res.status(404).end();
      return;
    }
    try {
      const bytes = await deps.storage.read(payload.ref);
      res.setHeader(
        "Content-Type",
        payload.contentType || "application/octet-stream"
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${payload.fileName.replace(/"/g, "")}"`
      );
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(bytes);
    } catch {
      res.status(404).end();
    }
  });

  return app;
}
