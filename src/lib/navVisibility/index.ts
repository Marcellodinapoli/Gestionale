import "server-only";
import type { SessionUser } from "@/lib/permissions";
import type { NavPageId, NavVisibilityMap } from "@/lib/navVisibility/catalog";
import { resolveEffectiveNavVisibility } from "@/lib/navVisibility/defaults";
import {
  loadNavRoleDefaults,
  loadNavUserOverrides,
} from "@/lib/navVisibility/store";

export async function getEffectiveNavVisibilityForUser(
  actor: Pick<SessionUser, "tenantId" | "tenantSlug">,
  target: Pick<SessionUser, "id" | "role" | "formazioneOnly">
): Promise<Record<NavPageId, boolean>> {
  const [roleDefaults, userOverrides] = await Promise.all([
    loadNavRoleDefaults(actor),
    loadNavUserOverrides(actor, target.id),
  ]);
  return resolveEffectiveNavVisibility({
    role: target.role,
    formazioneOnly: target.formazioneOnly,
    roleDefaults,
    userOverrides,
  });
}

/** Override rispetto al default ruolo (solo differenze). */
export function overridesFromFlags(
  roleDefaults: NavVisibilityMap,
  flags: NavVisibilityMap
): NavVisibilityMap {
  const out: NavVisibilityMap = {};
  for (const [id, visible] of Object.entries(flags)) {
    if (typeof visible !== "boolean") continue;
    const base = roleDefaults[id as NavPageId];
    if (base === visible) continue;
    out[id as NavPageId] = visible;
  }
  return out;
}
