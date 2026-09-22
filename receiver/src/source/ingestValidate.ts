import type { ResumeMeta } from "../models.js";

const FORBIDDEN_BODY_KEYS = new Set([
  "base64",
  "resumedata",
  "bytes",
  "buffer",
  "file",
  "content",
  "data",
  "cvurl",
  "openurl",
  "url",
  "internalstorageref",
  "receivercandidateid",
]);

export type IngestBody = {
  externalApplicationId: string;
  indeedJobId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  coverLetter?: string | null;
  receivedAt?: string | null;
  resumeMeta?: {
    present?: boolean;
    fileName?: string | null;
    contentType?: string | null;
    sizeBytes?: number | null;
  } | null;
  source?: string | null;
};

export type IngestValidationError = {
  status: 400;
  code: string;
  message: string;
};

function hasForbiddenKeys(value: unknown, path = ""): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = hasForbiddenKeys(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_BODY_KEYS.has(k.toLowerCase())) {
      return path ? `${path}.${k}` : k;
    }
    const hit = hasForbiddenKeys(v, path ? `${path}.${k}` : k);
    if (hit) return hit;
  }
  return null;
}

function asTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

/**
 * Valida body ingest SOURCE. Nessun CV/blob.
 */
export function validateIngestBody(
  raw: unknown,
  pathExternalApplicationId: string
): { ok: true; value: IngestBody } | { ok: false; error: IngestValidationError } {
  const forbidden = hasForbiddenKeys(raw);
  if (forbidden) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "FORBIDDEN_FIELD",
        message: `Campo non consentito: ${forbidden}`,
      },
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: { status: 400, code: "INVALID_BODY", message: "Body JSON richiesto" },
    };
  }
  const obj = raw as Record<string, unknown>;

  const pathExt = pathExternalApplicationId.trim();
  const bodyExt = asTrimmedString(obj.externalApplicationId);
  if (!pathExt) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "EXTERNAL_APPLICATION_ID_REQUIRED",
        message: "externalApplicationId path obbligatorio",
      },
    };
  }
  if (!bodyExt) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "EXTERNAL_APPLICATION_ID_REQUIRED",
        message: "externalApplicationId body obbligatorio",
      },
    };
  }
  if (bodyExt !== pathExt) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "EXTERNAL_APPLICATION_ID_MISMATCH",
        message: "externalApplicationId path/body non coincidono",
      },
    };
  }

  const indeedJobId = asTrimmedString(obj.indeedJobId);
  if (!indeedJobId) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INDEED_JOB_ID_REQUIRED",
        message: "indeedJobId obbligatorio",
      },
    };
  }

  const firstName = asTrimmedString(obj.firstName);
  const lastName = asTrimmedString(obj.lastName);
  if (!firstName || !lastName) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "NAME_REQUIRED",
        message: "firstName e lastName obbligatori",
      },
    };
  }

  if (
    obj.emailVerified != null &&
    typeof obj.emailVerified !== "boolean"
  ) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_EMAIL_VERIFIED",
        message: "emailVerified deve essere boolean",
      },
    };
  }

  let resumeMeta: IngestBody["resumeMeta"] = null;
  if (obj.resumeMeta != null) {
    if (typeof obj.resumeMeta !== "object" || Array.isArray(obj.resumeMeta)) {
      return {
        ok: false,
        error: {
          status: 400,
          code: "INVALID_RESUME_META",
          message: "resumeMeta non valido",
        },
      };
    }
    const rm = obj.resumeMeta as Record<string, unknown>;
    if (rm.documentId != null) {
      return {
        ok: false,
        error: {
          status: 400,
          code: "DOCUMENT_ID_NOT_ALLOWED",
          message: "documentId è generato dal Receiver",
        },
      };
    }
    const sizeBytes =
      rm.sizeBytes == null
        ? null
        : typeof rm.sizeBytes === "number" &&
            Number.isFinite(rm.sizeBytes) &&
            rm.sizeBytes >= 0
          ? Math.floor(rm.sizeBytes)
          : null;
    if (rm.sizeBytes != null && sizeBytes == null) {
      return {
        ok: false,
        error: {
          status: 400,
          code: "INVALID_SIZE_BYTES",
          message: "sizeBytes non valido",
        },
      };
    }
    resumeMeta = {
      present: Boolean(rm.present),
      fileName: asTrimmedString(rm.fileName),
      contentType: asTrimmedString(rm.contentType),
      sizeBytes,
    };
  }

  return {
    ok: true,
    value: {
      externalApplicationId: bodyExt,
      indeedJobId,
      firstName,
      lastName,
      email: asTrimmedString(obj.email),
      emailVerified:
        obj.emailVerified === true || obj.emailVerified === false
          ? obj.emailVerified
          : null,
      phone: asTrimmedString(obj.phone),
      coverLetter: asTrimmedString(obj.coverLetter),
      receivedAt: asTrimmedString(obj.receivedAt),
      resumeMeta,
      source: asTrimmedString(obj.source),
    },
  };
}

export function mergeResumeMetaForIngest(
  existing: ResumeMeta | null,
  incoming: IngestBody["resumeMeta"],
  documentId: string
): ResumeMeta {
  const present = existing?.present === true ? true : Boolean(incoming?.present);
  return {
    present,
    fileName: incoming?.fileName ?? existing?.fileName ?? null,
    contentType: incoming?.contentType ?? existing?.contentType ?? null,
    documentId: existing?.documentId || documentId,
    sizeBytes:
      present && existing?.sizeBytes != null
        ? existing.sizeBytes
        : (incoming?.sizeBytes ?? null),
  };
}
