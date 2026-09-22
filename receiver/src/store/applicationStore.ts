import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ApplicationRecord, DocumentRecord } from "../models.js";
import { logicalCvRef } from "../models.js";
import { newId } from "../auth.js";
import type { DocumentStorage } from "../storage/documentStorage.js";

export class DuplicateExternalApplicationError extends Error {
  constructor(message = "externalApplicationId già presente per il tenant") {
    super(message);
    this.name = "DuplicateExternalApplicationError";
  }
}

/**
 * Store multi-tenant con persistenza JSON opzionale (sopravvive ai restart).
 * Indici: (tenantId, receiverCandidateId), (tenantId, externalApplicationId), (tenantId, documentId)
 */
export class ApplicationStore {
  private readonly appsByCandidate = new Map<string, ApplicationRecord>();
  private readonly candidateByExternal = new Map<string, string>();
  private readonly docsById = new Map<string, DocumentRecord>();
  private lastListAtByTenant = new Map<string, string>();
  private readonly persistPath: string | null;

  constructor(
    private readonly storage: DocumentStorage,
    opts?: { persistPath?: string | null }
  ) {
    this.persistPath = opts?.persistPath?.trim() || null;
    if (this.persistPath) this.loadFromDisk();
  }

  private candKey(tenantId: string, receiverCandidateId: string) {
    return `${tenantId}::cand::${receiverCandidateId}`;
  }
  private extKey(tenantId: string, externalApplicationId: string) {
    return `${tenantId}::ext::${externalApplicationId}`;
  }
  private docKey(tenantId: string, documentId: string) {
    return `${tenantId}::doc::${documentId}`;
  }

  private loadFromDisk() {
    if (!this.persistPath || !existsSync(this.persistPath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.persistPath, "utf8")) as {
        apps?: ApplicationRecord[];
        docs?: DocumentRecord[];
        lastListAtByTenant?: Record<string, string>;
      };
      for (const app of raw.apps || []) {
        if (
          !app?.tenantId ||
          !app.receiverCandidateId ||
          !app.externalApplicationId
        ) {
          continue;
        }
        this.appsByCandidate.set(
          this.candKey(app.tenantId, app.receiverCandidateId),
          app
        );
        this.candidateByExternal.set(
          this.extKey(app.tenantId, app.externalApplicationId),
          app.receiverCandidateId
        );
      }
      for (const doc of raw.docs || []) {
        if (!doc?.tenantId || !doc.documentId) continue;
        this.docsById.set(this.docKey(doc.tenantId, doc.documentId), doc);
      }
      for (const [k, v] of Object.entries(raw.lastListAtByTenant || {})) {
        this.lastListAtByTenant.set(k, v);
      }
    } catch (e) {
      console.error("[receiver] store load failed", e);
    }
  }

  private persist() {
    if (!this.persistPath) return;
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      const payload = {
        apps: [...this.appsByCandidate.values()],
        docs: [...this.docsById.values()],
        lastListAtByTenant: Object.fromEntries(this.lastListAtByTenant),
      };
      writeFileSync(this.persistPath, JSON.stringify(payload, null, 2), "utf8");
    } catch (e) {
      console.error("[receiver] store persist failed", e);
    }
  }

  /** Seed interno (test / bootstrap). Non è un endpoint Credixa. */
  seedApplication(
    input: Omit<
      ApplicationRecord,
      "receiverCandidateId" | "createdAt" | "updatedAt" | "receivedAt"
    > & {
      receiverCandidateId?: string;
      receivedAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): ApplicationRecord {
    const tenantId = input.tenantId.trim();
    const externalApplicationId = input.externalApplicationId.trim();
    if (!tenantId || !externalApplicationId || !input.indeedJobId.trim()) {
      throw new Error("tenantId, externalApplicationId, indeedJobId obbligatori");
    }
    const ext = this.extKey(tenantId, externalApplicationId);
    if (this.candidateByExternal.has(ext)) {
      throw new DuplicateExternalApplicationError();
    }
    const now = new Date().toISOString();
    const receiverCandidateId =
      input.receiverCandidateId?.trim() || newId("rcv-cand");
    const record: ApplicationRecord = {
      tenantId,
      receiverCandidateId,
      externalApplicationId,
      indeedJobId: input.indeedJobId.trim(),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      emailVerified: input.emailVerified ?? null,
      phone: input.phone ?? null,
      coverLetter: input.coverLetter ?? null,
      receivedAt: input.receivedAt ?? now,
      resumeMeta: input.resumeMeta ?? null,
      cvRef: input.cvRef ?? null,
      source: input.source ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    this.appsByCandidate.set(
      this.candKey(tenantId, receiverCandidateId),
      record
    );
    this.candidateByExternal.set(ext, receiverCandidateId);
    this.persist();
    return record;
  }

  /**
   * Upsert SOURCE per (tenantId, externalApplicationId).
   * Genera receiverCandidateId e documentId solo alla creazione.
   */
  upsertByExternal(input: {
    tenantId: string;
    externalApplicationId: string;
    indeedJobId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    emailVerified?: boolean | null;
    phone?: string | null;
    coverLetter?: string | null;
    receivedAt?: string | null;
    source?: string | null;
    resumeHints?: {
      present?: boolean;
      fileName?: string | null;
      contentType?: string | null;
      sizeBytes?: number | null;
    } | null;
  }): { record: ApplicationRecord; created: boolean } {
    const tenantId = input.tenantId.trim();
    const externalApplicationId = input.externalApplicationId.trim();
    const existing = this.getByExternalId(tenantId, externalApplicationId);
    const now = new Date().toISOString();

    if (existing) {
      existing.indeedJobId = input.indeedJobId.trim();
      existing.firstName = input.firstName;
      existing.lastName = input.lastName;
      existing.email = input.email ?? null;
      existing.emailVerified = input.emailVerified ?? null;
      existing.phone = input.phone ?? null;
      existing.coverLetter = input.coverLetter ?? null;
      if (input.receivedAt) existing.receivedAt = input.receivedAt;
      if (input.source) existing.source = input.source;
      const docId =
        existing.resumeMeta?.documentId?.trim() || newId("rcv-doc");
      const alreadyPresent = existing.resumeMeta?.present === true;
      existing.resumeMeta = {
        present: alreadyPresent,
        fileName:
          input.resumeHints?.fileName ?? existing.resumeMeta?.fileName ?? null,
        contentType:
          input.resumeHints?.contentType ??
          existing.resumeMeta?.contentType ??
          null,
        documentId: docId,
        sizeBytes: alreadyPresent
          ? (existing.resumeMeta?.sizeBytes ?? null)
          : (input.resumeHints?.sizeBytes ?? null),
      };
      // cvRef solo se CV già presente
      if (!alreadyPresent) {
        existing.cvRef = existing.cvRef; // leave as-is (usually null)
      }
      existing.updatedAt = now;
      this.persist();
      return { record: existing, created: false };
    }

    const receiverCandidateId = newId("rcv-cand");
    const documentId = newId("rcv-doc");
    const record: ApplicationRecord = {
      tenantId,
      receiverCandidateId,
      externalApplicationId,
      indeedJobId: input.indeedJobId.trim(),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      emailVerified: input.emailVerified ?? null,
      phone: input.phone ?? null,
      coverLetter: input.coverLetter ?? null,
      receivedAt: input.receivedAt ?? now,
      resumeMeta: {
        present: false,
        fileName: input.resumeHints?.fileName ?? null,
        contentType: input.resumeHints?.contentType ?? null,
        documentId,
        sizeBytes: input.resumeHints?.sizeBytes ?? null,
      },
      cvRef: null,
      source: input.source ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.appsByCandidate.set(
      this.candKey(tenantId, receiverCandidateId),
      record
    );
    this.candidateByExternal.set(
      this.extKey(tenantId, externalApplicationId),
      receiverCandidateId
    );
    this.persist();
    return { record, created: true };
  }

  /**
   * Upload/replace CV. Idempotente su (tenantId, documentId).
   * documentId deve coincidere con quello riservato sulla candidatura.
   */
  async putDocument(opts: {
    tenantId: string;
    receiverCandidateId: string;
    documentId: string;
    fileName: string;
    contentType: string;
    bytes: Buffer;
  }): Promise<
    | { ok: true; doc: DocumentRecord }
    | { ok: false; status: 404 | 400 | 409; code: string }
  > {
    const app = this.getByCandidateId(opts.tenantId, opts.receiverCandidateId);
    if (!app) {
      return { ok: false, status: 404, code: "CANDIDATE_NOT_FOUND" };
    }

    const documentId = opts.documentId.trim();
    if (!documentId) {
      return { ok: false, status: 400, code: "DOCUMENT_ID_REQUIRED" };
    }

    const reserved = app.resumeMeta?.documentId?.trim();
    if (reserved && reserved !== documentId) {
      return { ok: false, status: 409, code: "DOCUMENT_ID_MISMATCH" };
    }

    const dk = this.docKey(opts.tenantId, documentId);
    const existingDoc = this.docsById.get(dk);
    if (
      existingDoc &&
      existingDoc.receiverCandidateId !== opts.receiverCandidateId
    ) {
      return { ok: false, status: 409, code: "DOCUMENT_ID_CONFLICT" };
    }

    const saved = await this.storage.save({
      tenantId: opts.tenantId,
      documentId,
      contentType: opts.contentType,
      bytes: opts.bytes,
    });

    const now = new Date().toISOString();
    const doc: DocumentRecord = {
      tenantId: opts.tenantId,
      receiverCandidateId: opts.receiverCandidateId,
      documentId,
      fileName: opts.fileName,
      contentType: opts.contentType,
      sizeBytes: saved.sizeBytes,
      internalStorageRef: saved.internalStorageRef,
      createdAt: existingDoc?.createdAt ?? now,
      updatedAt: now,
    };
    this.docsById.set(dk, doc);

    app.resumeMeta = {
      present: true,
      fileName: opts.fileName,
      contentType: opts.contentType,
      documentId,
      sizeBytes: saved.sizeBytes,
    };
    app.cvRef = logicalCvRef(documentId);
    app.updatedAt = now;
    this.persist();
    return { ok: true, doc };
  }

  /**
   * Associa un CV fisico a una candidatura (uso interno/test).
   */
  async attachDocument(opts: {
    tenantId: string;
    receiverCandidateId: string;
    fileName: string;
    contentType: string;
    bytes: Buffer;
    documentId?: string;
  }): Promise<DocumentRecord> {
    const app = this.getByCandidateId(opts.tenantId, opts.receiverCandidateId);
    if (!app) throw new Error("Candidatura non trovata");
    const documentId =
      opts.documentId?.trim() ||
      app.resumeMeta?.documentId?.trim() ||
      newId("rcv-doc");
    if (!app.resumeMeta?.documentId) {
      app.resumeMeta = {
        present: false,
        fileName: null,
        contentType: null,
        documentId,
        sizeBytes: null,
      };
    }
    const result = await this.putDocument({
      tenantId: opts.tenantId,
      receiverCandidateId: opts.receiverCandidateId,
      documentId,
      fileName: opts.fileName,
      contentType: opts.contentType,
      bytes: opts.bytes,
    });
    if (!result.ok) throw new Error(result.code);
    return result.doc;
  }

  getByCandidateId(
    tenantId: string,
    receiverCandidateId: string
  ): ApplicationRecord | null {
    return (
      this.appsByCandidate.get(
        this.candKey(tenantId, receiverCandidateId)
      ) ?? null
    );
  }

  getByExternalId(
    tenantId: string,
    externalApplicationId: string
  ): ApplicationRecord | null {
    const cid = this.candidateByExternal.get(
      this.extKey(tenantId, externalApplicationId)
    );
    if (!cid) return null;
    return this.getByCandidateId(tenantId, cid);
  }

  listByIndeedJobId(tenantId: string, indeedJobId: string): ApplicationRecord[] {
    const job = indeedJobId.trim();
    const out: ApplicationRecord[] = [];
    for (const app of this.appsByCandidate.values()) {
      if (app.tenantId === tenantId && app.indeedJobId === job) {
        out.push(app);
      }
    }
    this.lastListAtByTenant.set(tenantId, new Date().toISOString());
    return out.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }

  getDocument(
    tenantId: string,
    documentId: string
  ): DocumentRecord | null {
    return this.docsById.get(this.docKey(tenantId, documentId)) ?? null;
  }

  getDocumentForCandidate(
    tenantId: string,
    receiverCandidateId: string
  ): DocumentRecord | null {
    const app = this.getByCandidateId(tenantId, receiverCandidateId);
    const documentId = app?.resumeMeta?.documentId;
    if (!documentId) return null;
    const doc = this.getDocument(tenantId, documentId);
    if (!doc || doc.receiverCandidateId !== receiverCandidateId) return null;
    return doc;
  }

  syncStatus(tenantId: string): {
    ok: boolean;
    lastSyncAt: string | null;
    pendingCount: number;
  } {
    return {
      ok: true,
      lastSyncAt: this.lastListAtByTenant.get(tenantId) ?? null,
      pendingCount: 0,
    };
  }

  /** Solo test: reset completo. */
  clearForTests(): void {
    this.appsByCandidate.clear();
    this.candidateByExternal.clear();
    this.docsById.clear();
    this.lastListAtByTenant.clear();
  }
}
