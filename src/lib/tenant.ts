import type { SessionUser } from "@/lib/permissions";

export function requireTenantId(user: SessionUser): string {
  if (!user.tenantId) {
    throw new Error("Account non associato ad alcuna azienda");
  }
  return user.tenantId;
}

export function tenantWhere(user: SessionUser): { tenantId: string } {
  return { tenantId: requireTenantId(user) };
}

export function normalizeTenantSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}
