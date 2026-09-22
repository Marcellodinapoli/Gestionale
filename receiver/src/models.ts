export type ResumeMeta = {
  present: boolean;
  fileName?: string | null;
  contentType?: string | null;
  documentId?: string | null;
  sizeBytes?: number | null;
};

/** Persistenza interna candidatura. */
export type ApplicationRecord = {
  tenantId: string;
  receiverCandidateId: string;
  externalApplicationId: string;
  indeedJobId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  coverLetter?: string | null;
  receivedAt: string;
  resumeMeta: ResumeMeta | null;
  /** Riferimento logico CV — mai path/URL. */
  cvRef: string | null;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Persistenza interna documento. `internalStorageRef` mai in API. */
export type DocumentRecord = {
  tenantId: string;
  receiverCandidateId: string;
  documentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  internalStorageRef: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Shape Credixa `ReceiverCandidate` — senza campi interni.
 */
export type ReceiverCandidateDto = {
  receiverCandidateId: string;
  externalApplicationId: string;
  indeedJobId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  coverLetter?: string | null;
  receivedAt?: string | null;
  resumeMeta?: ResumeMeta | null;
  cvRef?: string | null;
};

export function toReceiverCandidateDto(
  app: ApplicationRecord
): ReceiverCandidateDto {
  return {
    receiverCandidateId: app.receiverCandidateId,
    externalApplicationId: app.externalApplicationId,
    indeedJobId: app.indeedJobId,
    firstName: app.firstName ?? null,
    lastName: app.lastName ?? null,
    email: app.email ?? null,
    emailVerified:
      app.emailVerified === true || app.emailVerified === false
        ? app.emailVerified
        : null,
    phone: app.phone ?? null,
    coverLetter: app.coverLetter ?? null,
    receivedAt: app.receivedAt ?? null,
    resumeMeta: app.resumeMeta
      ? {
          present: Boolean(app.resumeMeta.present),
          fileName: app.resumeMeta.fileName ?? null,
          contentType: app.resumeMeta.contentType ?? null,
          documentId: app.resumeMeta.documentId ?? null,
          sizeBytes:
            typeof app.resumeMeta.sizeBytes === "number"
              ? app.resumeMeta.sizeBytes
              : null,
        }
      : null,
    cvRef: app.cvRef ?? null,
  };
}

/** Formato logico cvRef — non path storage. */
export function logicalCvRef(documentId: string): string {
  const id = String(documentId || "").trim();
  if (!id) throw new Error("documentId obbligatorio");
  if (id.startsWith("rcv-cv:")) return id;
  return `rcv-cv:${id}`;
}
