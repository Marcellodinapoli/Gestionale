import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile, access } from "node:fs/promises";
import path from "node:path";
import type {
  DocumentStorage,
  SaveDocumentInput,
  TemporaryAccess,
} from "./documentStorage.js";

type TmpTokenPayload = {
  tenantId: string;
  documentId: string;
  ref: string;
  contentType: string;
  fileName: string;
  exp: number;
};

/**
 * Adapter locale per sviluppo/test.
 * File sotto `{root}/{tenantId}/{documentId}.bin` — path mai esposto via API Credixa.
 */
export class LocalDocumentStorage implements DocumentStorage {
  constructor(
    private readonly rootDir: string,
    private publicBaseUrl: string,
    private readonly signingSecret: string,
    /** Resolver path → absolute URL for tmp open (injected by server). */
    private readonly tmpPathPrefix = "/v1/tmp"
  ) {}

  /** Aggiorna base URL pubblica (es. dopo bind porta dinamica nei test). */
  setPublicBaseUrl(url: string): void {
    this.publicBaseUrl = url.replace(/\/+$/, "");
  }

  private filePath(tenantId: string, documentId: string): string {
    const safeTenant = tenantId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeDoc = documentId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this.rootDir, safeTenant, `${safeDoc}.bin`);
  }

  async save(input: SaveDocumentInput): Promise<{
    internalStorageRef: string;
    sizeBytes: number;
  }> {
    const fp = this.filePath(input.tenantId, input.documentId);
    await mkdir(path.dirname(fp), { recursive: true });
    await writeFile(fp, input.bytes);
    // Ref interno opaco (non URL, non path grezzo restituito alle API)
    const internalStorageRef = `local://${input.tenantId}/${input.documentId}`;
    return { internalStorageRef, sizeBytes: input.bytes.length };
  }

  private resolveRef(internalStorageRef: string): { tenantId: string; documentId: string } {
    const m = /^local:\/\/([^/]+)\/(.+)$/.exec(internalStorageRef);
    if (!m) throw new Error("internalStorageRef non valido");
    return { tenantId: m[1]!, documentId: m[2]! };
  }

  async exists(internalStorageRef: string): Promise<boolean> {
    try {
      const { tenantId, documentId } = this.resolveRef(internalStorageRef);
      await access(this.filePath(tenantId, documentId));
      return true;
    } catch {
      return false;
    }
  }

  async read(internalStorageRef: string): Promise<Buffer> {
    const { tenantId, documentId } = this.resolveRef(internalStorageRef);
    return readFile(this.filePath(tenantId, documentId));
  }

  async delete(internalStorageRef: string): Promise<void> {
    const { tenantId, documentId } = this.resolveRef(internalStorageRef);
    try {
      await unlink(this.filePath(tenantId, documentId));
    } catch {
      // ignore missing
    }
  }

  async createTemporaryAccess(input: {
    tenantId: string;
    documentId: string;
    internalStorageRef: string;
    contentType: string;
    fileName: string;
    ttlSeconds: number;
  }): Promise<TemporaryAccess> {
    const exp = Math.floor(Date.now() / 1000) + Math.max(30, input.ttlSeconds);
    const payload: TmpTokenPayload = {
      tenantId: input.tenantId,
      documentId: input.documentId,
      ref: input.internalStorageRef,
      contentType: input.contentType,
      fileName: input.fileName,
      exp,
    };
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", this.signingSecret)
      .update(body)
      .digest("base64url");
    const token = `${body}.${sig}`;
    const base = this.publicBaseUrl.replace(/\/+$/, "");
    return {
      openUrl: `${base}${this.tmpPathPrefix}/${encodeURIComponent(token)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /** Verifica token tmp e restituisce payload (per route /v1/tmp). */
  verifyTemporaryToken(token: string): TmpTokenPayload | null {
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    if (!body || !sig) return null;
    const expected = createHmac("sha256", this.signingSecret)
      .update(body)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const payload = JSON.parse(
        Buffer.from(body, "base64url").toString("utf8")
      ) as TmpTokenPayload;
      if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
