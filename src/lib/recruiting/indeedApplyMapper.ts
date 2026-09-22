/**
 * Mapper Indeed Apply → RecruitingCandidaturaReceiverUpsertInput.
 * Nessuna HTTP, nessun persist CV. Stato RICEVUTA lasciato al repo upsert.
 *
 * Mapping documentato:
 *   applicationId     → externalApplicationId
 *   firstName/lastName → nome/cognome (fallback fullName)
 *   email             → email
 *   emailVerified     → emailVerified
 *   phoneNumber       → phone
 *   coverletter       → coverLetter
 *   jobId             → offerta via findOffertaByIndeedJobId(tenantId, jobId)
 *   resume.*          → solo resumeMeta (fuori dal modello persistente)
 *   source            → source (se presente)
 */

import type { OffertaLavoroRecord } from "@/lib/recruiting/offerte";
import type { RecruitingCandidaturaReceiverUpsertInput } from "@/lib/recruiting/candidature";
import { validaCandidaturaReceiverUpsertInput } from "@/lib/recruiting/candidature";
import {
  IndeedApplyMappingError,
  type IndeedApplyApplication,
  type IndeedApplyResumeMeta,
  type IndeedApplyScreenerQuestion,
} from "@/lib/recruiting/indeedApply";

export type IndeedApplyMapperDeps = {
  findOffertaByIndeedJobId: (
    tenantId: string,
    indeedJobId: string
  ) => Promise<OffertaLavoroRecord | null>;
};

/** Risultato mapping: upsert persistibile + dati Indeed non salvati su candidatura. */
export type IndeedApplyMappedCandidatura = {
  upsert: RecruitingCandidaturaReceiverUpsertInput;
  /** Solo metadati CV — non trasferiti nel modello persistente. */
  resumeMeta: IndeedApplyResumeMeta | null;
  screenerQuestions: IndeedApplyScreenerQuestion[];
  jobMeta: Record<string, unknown> | null;
  analytics: Record<string, unknown> | null;
};

async function defaultFindOfferta(
  tenantId: string,
  indeedJobId: string
): Promise<OffertaLavoroRecord | null> {
  const { findOffertaByIndeedJobId } = await import("@/lib/recruiting/offerteRepo");
  return findOffertaByIndeedJobId(tenantId, indeedJobId);
}

function trimOrNull(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

/**
 * Estrae solo metadati CV. Ignora / non espone eventuali campi contenuto
 * se presenti per errore nel payload grezzo.
 */
export function extractIndeedApplyResumeMeta(
  resume: IndeedApplyApplication["resume"]
): IndeedApplyResumeMeta | null {
  if (!resume || typeof resume !== "object") return null;
  const present = Boolean(resume.present);
  const fileName = trimOrNull(resume.fileName);
  const contentType = trimOrNull(resume.contentType);
  const documentId = trimOrNull(resume.documentId);
  const receiverDocumentRef = trimOrNull(resume.receiverDocumentRef);
  if (!present && !fileName && !contentType && !documentId && !receiverDocumentRef) {
    return null;
  }
  return {
    present,
    fileName,
    contentType,
    documentId,
    receiverDocumentRef,
  };
}

function resolveCandidateNames(app: IndeedApplyApplication): {
  nome: string;
  cognome: string;
} {
  let nome = trimOrNull(app.firstName) || "";
  let cognome = trimOrNull(app.lastName) || "";
  if (!nome && !cognome) {
    const full = trimOrNull(app.fullName);
    if (full) {
      const parts = full.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        cognome = parts[0]!;
      } else {
        nome = parts[0]!;
        cognome = parts.slice(1).join(" ");
      }
    }
  }
  if (!cognome && !nome) {
    throw new IndeedApplyMappingError(
      "MISSING_CANDIDATE_NAME",
      "Indeed Apply: nome/cognome candidato mancanti (firstName/lastName/fullName)"
    );
  }
  return {
    nome: nome || "—",
    cognome: cognome || "—",
  };
}

/**
 * Mappa un'application Indeed Apply verso l'input upsert Credixa.
 * Richiede tenantId + jobId risolto su OffertaLavoro.indeedJobId.
 */
export async function mapIndeedApplyToCandidaturaUpsert(
  application: IndeedApplyApplication,
  options: { tenantId: string },
  deps?: IndeedApplyMapperDeps
): Promise<IndeedApplyMappedCandidatura> {
  const tenantId = String(options.tenantId || "").trim();
  if (!tenantId) {
    throw new IndeedApplyMappingError(
      "MISSING_TENANT_ID",
      "Indeed Apply: tenantId obbligatorio"
    );
  }

  const applicationId = trimOrNull(application.applicationId);
  if (!applicationId) {
    throw new IndeedApplyMappingError(
      "MISSING_APPLICATION_ID",
      "Indeed Apply: applicationId obbligatorio"
    );
  }

  const jobId = trimOrNull(application.jobId);
  if (!jobId) {
    throw new IndeedApplyMappingError(
      "MISSING_JOB_ID",
      "Indeed Apply: jobId obbligatorio"
    );
  }

  const findOfferta =
    deps?.findOffertaByIndeedJobId ?? defaultFindOfferta;
  const offerta = await findOfferta(tenantId, jobId);
  if (!offerta || offerta.tenantId !== tenantId) {
    throw new IndeedApplyMappingError(
      "OFFERTA_NOT_FOUND",
      `Indeed Apply: nessuna OffertaLavoro Credixa per indeedJobId «${jobId}» nel tenant indicato`
    );
  }

  const { nome, cognome } = resolveCandidateNames(application);
  const resumeMeta = extractIndeedApplyResumeMeta(application.resume);

  const upsert = validaCandidaturaReceiverUpsertInput({
    offertaId: offerta.id,
    externalApplicationId: applicationId,
    cognome,
    nome,
    email: application.email,
    emailVerified: application.emailVerified,
    phone: application.phoneNumber,
    coverLetter: application.coverletter,
    source: application.source,
    // CV non trasferito: nessun receiverCandidateId da resume documentId
    // (resta fuori dal modello persistente in resumeMeta).
  });

  return {
    upsert,
    resumeMeta,
    screenerQuestions: Array.isArray(application.screenerQuestions)
      ? application.screenerQuestions
      : [],
    jobMeta:
      application.jobMeta && typeof application.jobMeta === "object"
        ? { ...application.jobMeta }
        : null,
    analytics:
      application.analytics && typeof application.analytics === "object"
        ? { ...application.analytics }
        : null,
  };
}
