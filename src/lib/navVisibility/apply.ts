import "server-only";
import type { Role, SessionUser } from "@/lib/permissions";
import type { NavVisibilityMap } from "@/lib/navVisibility/catalog";
import { overridesFromFlags } from "@/lib/navVisibility";
import {
  loadNavRoleDefaults,
  saveNavUserOverrides,
} from "@/lib/navVisibility/store";
import { mergeRoleDefaults, systemRoleNavDefaults } from "@/lib/navVisibility/defaults";

/** Salva solo le differenze dal default ruolo come eccezioni utente. */
export async function applyNavFlagsForNewUser(
  actor: Pick<SessionUser, "tenantId" | "tenantSlug">,
  userId: string,
  role: Role,
  flags: NavVisibilityMap
) {
  const roleDefaults = await loadNavRoleDefaults(actor);
  const base =
    mergeRoleDefaults(roleDefaults)[role] || systemRoleNavDefaults(role);
  const overrides = overridesFromFlags(base, { ...flags, account: true });
  await saveNavUserOverrides(actor, userId, overrides);
}
