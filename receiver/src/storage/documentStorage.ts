export type SaveDocumentInput = {
  tenantId: string;
  documentId: string;
  contentType: string;
  bytes: Buffer;
};

export type TemporaryAccess = {
  openUrl: string;
  expiresAt: string;
};

/**
 * Astrazione storage documenti — indipendente dal provider cloud.
 * `internalStorageRef` resta interno al Receiver.
 */
export interface DocumentStorage {
  save(input: SaveDocumentInput): Promise<{ internalStorageRef: string; sizeBytes: number }>;
  exists(internalStorageRef: string): Promise<boolean>;
  read(internalStorageRef: string): Promise<Buffer>;
  createTemporaryAccess(input: {
    tenantId: string;
    documentId: string;
    internalStorageRef: string;
    contentType: string;
    fileName: string;
    ttlSeconds: number;
  }): Promise<TemporaryAccess>;
  delete(internalStorageRef: string): Promise<void>;
}
