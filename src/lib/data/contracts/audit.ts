export type AuditLogFilter = {
  tenantId?: string;
  userId?: string;
  action?: string | string[];
  entity?: string;
  entityId?: string;
  entityIdsIn?: string[];
  createdAtGte?: string;
  createdAtLt?: string;
  take?: number;
  skip?: number;
  orderBy?: "asc" | "desc";
  includeUser?: boolean;
};

export type AuditLogDto = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  dettaglio: string | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
};

export type AuditCreateInput = {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  dettaglio?: string | null;
};

export interface AuditRepository {
  append(tenantSlug: string, input: AuditCreateInput): Promise<void>;
  list(tenantSlug: string, tenantId: string, filter?: AuditLogFilter): Promise<AuditLogDto[]>;
}
