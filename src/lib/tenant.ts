import { findTenantById } from "@/lib/data/operationalAccess";
import { isConnectorProvider } from "@/lib/data/factory";
import type { SessionUser } from "@/lib/permissions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Slug tenant per URL Connector (mai l'UUID). */
export async function resolveTenantSlugForConnector(
  tenantId: string,
  tenantSlug?: string | null
): Promise<string> {
  const slug = (tenantSlug ?? "").trim();
  if (slug && !UUID_RE.test(slug)) return slug;
  if (!isConnectorProvider()) return slug || tenantId;
  const tenant = await findTenantById(tenantId);
  if (!tenant?.slug) throw new Error(`Tenant non trovato: ${tenantId}`);
  return tenant.slug;
}

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
