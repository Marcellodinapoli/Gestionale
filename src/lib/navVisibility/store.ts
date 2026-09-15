import "server-only";
import { configurazioneDb } from "@/lib/configurazioneRepo";
import type { SessionUser } from "@/lib/permissions";
import {
  NAV_ROLE_DEFAULTS_KEY,
  NAV_USER_OVERRIDES_KEY,
  type NavRoleDefaults,
  type NavUserOverrides,
  type NavVisibilityMap,
} from "@/lib/navVisibility/catalog";
import { mergeRoleDefaults } from "@/lib/navVisibility/defaults";
import { resolveTenantSlug } from "@/lib/praticheRepo";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readChiave(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  chiave: string
) {
  const row = await configurazioneDb({
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
  }).findUnique({
    where: {
      tenantId_chiave: { tenantId: user.tenantId, chiave },
    },
    select: { valore: true },
  });
  return row?.valore ?? null;
}

async function writeChiave(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  chiave: string,
  valore: string
) {
  await configurazioneDb({
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
  }).upsert({
    where: {
      tenantId_chiave: { tenantId: user.tenantId, chiave },
    },
    create: {
      tenantId: user.tenantId,
      chiave,
      valore,
      categoria: "nav",
    },
    update: { valore, categoria: "nav" },
  });
}

export async function loadNavRoleDefaults(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">
): Promise<NavRoleDefaults> {
  const raw = await readChiave(user, NAV_ROLE_DEFAULTS_KEY);
  return mergeRoleDefaults(parseJson<NavRoleDefaults>(raw, {}));
}

export async function saveNavRoleDefaults(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  defaults: NavRoleDefaults
) {
  await writeChiave(user, NAV_ROLE_DEFAULTS_KEY, JSON.stringify(defaults));
}

export async function loadNavUserOverridesAll(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">
): Promise<NavUserOverrides> {
  const raw = await readChiave(user, NAV_USER_OVERRIDES_KEY);
  return parseJson<NavUserOverrides>(raw, {});
}

export async function loadNavUserOverrides(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  userId: string
): Promise<NavVisibilityMap> {
  const all = await loadNavUserOverridesAll(user);
  return all[userId] || {};
}

export async function saveNavUserOverrides(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  userId: string,
  overrides: NavVisibilityMap
) {
  const all = await loadNavUserOverridesAll(user);
  const cleaned: NavVisibilityMap = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === "boolean") cleaned[k as keyof NavVisibilityMap] = v;
  }
  if (Object.keys(cleaned).length === 0) {
    delete all[userId];
  } else {
    all[userId] = cleaned;
  }
  await writeChiave(user, NAV_USER_OVERRIDES_KEY, JSON.stringify(all));
}
