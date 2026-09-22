/**
 * Sync manuale Receiver → Credixa (Indeed Apply).
 * Nessuno scheduler. Nessun CV persistito.
 */

import type { OffertaLavoroRecord } from "@/lib/recruiting/offerte";
import type { IndeedApplyApplication } from "@/lib/recruiting/indeedApply";
import { IndeedApplyMappingError } from "@/lib/recruiting/indeedApply";
import { mapIndeedApplyToCandidaturaUpsert } from "@/lib/recruiting/indeedApplyMapper";
import {
  isReceiverClientError,
  receiverErrorPublicMessage,
  type ReceiverCandidate,
  type ReceiverCvOpenResult,
  type RecruitingReceiverConfigRecord,
} from "@/lib/recruiting/receiver";
import type { RecruitingCandidaturaRecord } from "@/lib/recruiting/candidature";

export type IndeedSyncItemOutcome = "created" | "updated" | "skipped" | "error";

export type IndeedSyncItemResult = {
  applicationId: string | null;
  outcome: IndeedSyncItemOutcome;
  code?: string;
  message?: string;
};

export type IndeedSyncResult = {
  received: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  items: IndeedSyncItemResult[];
};

export type IndeedSyncErrorCode =
  | "OFFERTA_NOT_FOUND"
  | "CANDIDATURA_NOT_FOUND"
  | "INDEED_JOB_ID_MISSING"
  | "RECEIVER_NOT_CONFIGURED"
  | "RECEIVER_NOT_ACTIVE"
  | "RECEIVER_ERROR"
  | "UNAUTHORIZED";

export class IndeedSyncError extends Error {
  readonly code: IndeedSyncErrorCode;

  constructor(code: IndeedSyncErrorCode, message: string) {
    super(message);
    this.name = "IndeedSyncError";
    this.code = code;
  }
}

export type IndeedApplySyncDeps = {
  getOffertaLavoro: (
    tenantId: string,
    offertaId: string
  ) => Promise<OffertaLavoroRecord | null>;
  getReceiverConfig: (
    tenantId: string
  ) => Promise<RecruitingReceiverConfigRecord | null>;
  listApplications: (
    tenantId: string,
    indeedJobId: string
  ) => Promise<ReceiverCandidate[]>;
  findByExternalApplicationId: (
    tenantId: string,
    externalApplicationId: string
  ) => Promise<RecruitingCandidaturaRecord | null>;
  findByContactOnOfferta?: (
    tenantId: string,
    offertaId: string,
    contact: { email?: string | null; phone?: string | null }
  ) => Promise<RecruitingCandidaturaRecord | null>;
  upsertFromReceiver: (
    tenantId: string,
    input: Parameters<
      typeof import("@/lib/recruiting/candidatureRepo").upsertCandidaturaFromReceiver
    >[1],
    createdById: string
  ) => Promise<RecruitingCandidaturaRecord>;
  getCandidatura: (
    tenantId: string,
    id: string
  ) => Promise<RecruitingCandidaturaRecord | null>;
  getCvOpenUrl: (
    tenantId: string,
    receiverCandidateId: string
  ) => Promise<ReceiverCvOpenResult>;
  now?: () => number;
  log?: (event: string, data: Record<string, unknown>) => void;
};

function defaultLog(event: string, data: Record<string, unknown>) {
  console.info("[recruiting.indeed.sync]", event, data);
}

function isUniqueConflict(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique|duplicate|UQ_RecruitingCandidature_Tenant_ExternalApplicationId/i.test(
    msg
  );
}

function receiverCandidateToIndeedApply(
  c: ReceiverCandidate,
  sourceName?: string
): IndeedApplyApplication {
  return {
    applicationId: c.externalApplicationId,
    jobId: c.indeedJobId,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    emailVerified: c.emailVerified,
    phoneNumber: c.phone,
    coverletter: c.coverLetter,
    resume: c.resumeMeta
      ? {
          present: Boolean(c.resumeMeta.present),
          fileName: c.resumeMeta.fileName,
          contentType: c.resumeMeta.contentType,
          documentId: c.resumeMeta.documentId,
          receiverDocumentRef: c.cvRef ?? null,
        }
      : c.cvRef
        ? { present: true, receiverDocumentRef: c.cvRef }
        : null,
    source: sourceName || "indeed",
  };
}

/**
 * Sincronizza le candidature Receiver per un'offerta Credixa.
 * tenantId deve provenire dal contesto autenticato.
 */
export async function syncIndeedApplicationsForOfferta(
  input: {
    tenantId: string;
    offertaId: string;
    userId: string;
  },
  deps: IndeedApplySyncDeps
): Promise<IndeedSyncResult> {
  const log = deps.log ?? defaultLog;
  const started = (deps.now ?? Date.now)();
  const tenantId = String(input.tenantId || "").trim();
  const offertaId = String(input.offertaId || "").trim();
  const userId = String(input.userId || "").trim();

  if (!tenantId || !userId) {
    throw new IndeedSyncError("UNAUTHORIZED", "Contesto non autorizzato");
  }
  if (!offertaId) {
    throw new IndeedSyncError("OFFERTA_NOT_FOUND", "Offerta non indicata");
  }

  const offerta = await deps.getOffertaLavoro(tenantId, offertaId);
  if (!offerta || offerta.tenantId !== tenantId) {
    throw new IndeedSyncError("OFFERTA_NOT_FOUND", "Offerta non trovata");
  }

  const indeedJobId = String(offerta.indeedJobId || "").trim();
  if (!indeedJobId) {
    throw new IndeedSyncError(
      "INDEED_JOB_ID_MISSING",
      "Offerta senza indeedJobId"
    );
  }

  const receiver = await deps.getReceiverConfig(tenantId);
  if (!receiver) {
    throw new IndeedSyncError(
      "RECEIVER_NOT_CONFIGURED",
      "Ricevitore non configurato"
    );
  }
  if (receiver.status !== "ACTIVE") {
    throw new IndeedSyncError(
      "RECEIVER_NOT_ACTIVE",
      "Ricevitore non attivo"
    );
  }

  let candidates: ReceiverCandidate[];
  try {
    candidates = await deps.listApplications(tenantId, indeedJobId);
  } catch (e) {
    if (isReceiverClientError(e)) {
      log("list_failed", {
        offertaId,
        code: e.code,
        durationMs: (deps.now ?? Date.now)() - started,
      });
      throw new IndeedSyncError(
        "RECEIVER_ERROR",
        receiverErrorPublicMessage(e)
      );
    }
    throw e;
  }

  const result: IndeedSyncResult = {
    received: candidates.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    items: [],
  };

  for (const candidate of candidates) {
    const applicationId =
      String(candidate.externalApplicationId || "").trim() || null;
    try {
      if (!applicationId) {
        result.skipped += 1;
        result.errors += 1;
        result.items.push({
          applicationId: null,
          outcome: "error",
          code: "MISSING_APPLICATION_ID",
          message: "applicationId mancante",
        });
        continue;
      }

      const candJobId = String(candidate.indeedJobId || "").trim();
      if (!candJobId) {
        result.skipped += 1;
        result.errors += 1;
        result.items.push({
          applicationId,
          outcome: "error",
          code: "MISSING_JOB_ID",
          message: "indeedJobId mancante sulla candidatura",
        });
        continue;
      }

      if (candJobId !== indeedJobId) {
        result.skipped += 1;
        result.errors += 1;
        result.items.push({
          applicationId,
          outcome: "error",
          code: "JOB_MISMATCH",
          message: "indeedJobId non corrisponde all'offerta",
        });
        log("item_skip", {
          offertaId,
          applicationId,
          code: "JOB_MISMATCH",
        });
        continue;
      }

      const existing =
        (await deps.findByExternalApplicationId(tenantId, applicationId)) ||
        (deps.findByContactOnOfferta
          ? await deps.findByContactOnOfferta(tenantId, offertaId, {
              email: candidate.email,
              phone: candidate.phone,
            })
          : null);

      const indeedApp = receiverCandidateToIndeedApply(
        candidate,
        receiver.sourceName || "indeed"
      );

      const mapped = await mapIndeedApplyToCandidaturaUpsert(
        indeedApp,
        { tenantId },
        {
          findOffertaByIndeedJobId: async (tid, jid) => {
            if (tid !== tenantId) return null;
            if (jid !== indeedJobId) return null;
            return offerta;
          },
        }
      );

      // Non persistere CV: solo receiverCandidateId tecnico + campi Fase 1
      const upsertInput = {
        ...mapped.upsert,
        receiverCandidateId: candidate.receiverCandidateId,
        // coverLetter già in upsert; nessun openUrl / resume blob
      };

      try {
        await deps.upsertFromReceiver(tenantId, upsertInput, userId);
      } catch (e) {
        if (isUniqueConflict(e)) {
          await deps.upsertFromReceiver(tenantId, upsertInput, userId);
        } else {
          throw e;
        }
      }

      if (existing) {
        result.updated += 1;
        result.items.push({ applicationId, outcome: "updated" });
        log("item_updated", { offertaId, applicationId });
      } else {
        result.created += 1;
        result.items.push({ applicationId, outcome: "created" });
        log("item_created", { offertaId, applicationId });
      }

      // resumeMeta.present non viene salvato come file — solo contatti/anagrafica
      void mapped.resumeMeta;
    } catch (e) {
      result.errors += 1;
      result.skipped += 1;
      let code = "ITEM_ERROR";
      let message = "Candidatura non sincronizzata";
      if (e instanceof IndeedApplyMappingError) {
        code = e.code;
        message = e.message;
      } else if (e instanceof Error) {
        message = e.message || "Errore durante la sincronizzazione della candidatura";
        if (/migration 034|Indeed Apply non disponibili/i.test(e.message)) {
          code = "SCHEMA_MISSING";
        }
      }
      result.items.push({
        applicationId,
        outcome: "error",
        code,
        message,
      });
      log("item_error", { offertaId, applicationId, code });
    }
  }

  log("sync_done", {
    offertaId,
    received: result.received,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.errors,
    durationMs: (deps.now ?? Date.now)() - started,
  });

  return result;
}

/**
 * URL temporaneo CV dal Receiver. Non persiste nulla.
 */
export async function openIndeedCandidateCv(
  input: {
    tenantId: string;
    candidaturaId: string;
  },
  deps: Pick<
    IndeedApplySyncDeps,
    "getCandidatura" | "getCvOpenUrl" | "log"
  >
): Promise<{
  openUrl: string;
  expiresAt: string | null;
  fileName: string | null;
}> {
  const log = deps.log ?? defaultLog;
  const tenantId = String(input.tenantId || "").trim();
  const candidaturaId = String(input.candidaturaId || "").trim();
  if (!tenantId) {
    throw new IndeedSyncError("UNAUTHORIZED", "Contesto non autorizzato");
  }
  if (!candidaturaId) {
    throw new IndeedSyncError("CANDIDATURA_NOT_FOUND", "Candidatura non indicata");
  }

  const candidatura = await deps.getCandidatura(tenantId, candidaturaId);
  if (!candidatura || candidatura.tenantId !== tenantId) {
    throw new IndeedSyncError("CANDIDATURA_NOT_FOUND", "Candidatura non trovata");
  }

  const receiverCandidateId = String(
    candidatura.receiverCandidateId || ""
  ).trim();
  if (!receiverCandidateId) {
    throw new IndeedSyncError(
      "RECEIVER_ERROR",
      "Candidatura senza riferimento Receiver"
    );
  }

  try {
    const opened = await deps.getCvOpenUrl(tenantId, receiverCandidateId);
    log("cv_open", {
      candidaturaId,
      ok: true,
    });
    return {
      openUrl: opened.openUrl,
      expiresAt: opened.expiresAt ?? null,
      fileName: opened.fileName ?? null,
    };
  } catch (e) {
    log("cv_open", {
      candidaturaId,
      ok: false,
      code: isReceiverClientError(e) ? e.code : "CV_ERROR",
    });
    if (isReceiverClientError(e)) {
      throw new IndeedSyncError(
        "RECEIVER_ERROR",
        receiverErrorPublicMessage(e)
      );
    }
    throw e;
  }
}
