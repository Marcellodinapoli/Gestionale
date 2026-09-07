import "server-only";

export type LinkRequestStatus = "pending" | "consumed" | "expired" | "revoked";

export type CreditCalcLinkRequest = {
  linkRequestId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  gestionaleUserId: string;
  operatorName: string;
  operatorEmail: string;
  createdByUserId: string;
  status: LinkRequestStatus;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string | null;
  consumedByCreditCalcUserId?: string | null;
};

export type ConnectionStatus = "active" | "revoked";

export type CreditCalcConnection = {
  connectionId: string;
  creditCalcUserId: string;
  gestionaleUserId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  operatorName: string;
  operatorEmail: string;
  status: ConnectionStatus;
  createdAt: string;
  revokedAt?: string | null;
};

export const LINK_REQUEST_TTL_MS = 10 * 60 * 1000;

export const COL_LINK_REQUESTS = "creditcalc_link_requests";
export const COL_CONNECTIONS = "creditcalc_connections";
export const COL_TENANT_CONNECTOR = "tenant_connector_config";
