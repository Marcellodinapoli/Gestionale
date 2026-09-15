"use server";

import { revalidatePath } from "next/cache";
import { requireWritablePermission } from "@/lib/guard";
import { writeAudit } from "@/lib/domain";
import type { Role } from "@/lib/permissions";
import {
  NAV_PAGE_IDS,
  NAV_VISIBILITY_ROLES,
  type NavRoleDefaults,
  type NavVisibilityMap,
} from "@/lib/navVisibility/catalog";
import { loadNavRoleDefaults, saveNavRoleDefaults } from "@/lib/navVisibility/store";
import { applyNavFlagsForNewUser } from "@/lib/navVisibility/apply";

function fail(message: string): never {
  throw new Error(message);
}

function parseVisibilityMap(raw: unknown): NavVisibilityMap {
  if (!raw || typeof raw !== "object") return {};
  const out: NavVisibilityMap = {};
  for (const id of NAV_PAGE_IDS) {
    if (id === "account") continue;
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === "boolean") out[id] = v;
  }
  return out;
}

export async function saveNavRoleDefaultsAction(formData: FormData) {
  const user = await requireWritablePermission("users:manage");
  const raw = String(formData.get("payload") || "").trim();
  let parsed: NavRoleDefaults;
  try {
    parsed = JSON.parse(raw) as NavRoleDefaults;
  } catch {
    fail("Payload non valido");
  }

  const cleaned: NavRoleDefaults = {};
  for (const role of NAV_VISIBILITY_ROLES) {
    const map = parseVisibilityMap(parsed[role]);
    map.account = true;
    cleaned[role] = map;
  }

  await saveNavRoleDefaults(user, cleaned);
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "configurazione",
    dettaglio: "preferenze visibilità pagine per ruolo",
  });
  revalidatePath("/configurazione");
  revalidatePath("/configurazione/visibilita");
  revalidatePath("/operatori");
}

export async function saveNavUserOverridesAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const role = String(formData.get("role") || "").trim() as Role;
  if (!targetId) fail("Utente mancante");

  const raw = String(formData.get("payload") || "").trim();
  let flags: NavVisibilityMap;
  try {
    flags = parseVisibilityMap(JSON.parse(raw));
  } catch {
    fail("Payload non valido");
  }

  await applyNavFlagsForNewUser(user, targetId, role, flags);
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: "eccezioni visibilità pagine",
  });
  revalidatePath("/operatori");
  revalidatePath("/configurazione/visibilita");
}

/** Aggiorna solo il default di un tipo account (vale per tutti gli utenti di quel ruolo). */
export async function saveNavSingleRoleDefaultsAction(formData: FormData) {
  const user = await requireWritablePermission("users:manage");
  const role = String(formData.get("role") || "").trim() as Role;
  if (!NAV_VISIBILITY_ROLES.includes(role)) fail("Ruolo non valido");

  const raw = String(formData.get("payload") || "").trim();
  let flags: NavVisibilityMap;
  try {
    flags = parseVisibilityMap(JSON.parse(raw));
  } catch {
    fail("Payload non valido");
  }
  flags.account = true;

  const current = await loadNavRoleDefaults(user);
  const next: NavRoleDefaults = { ...current, [role]: flags };
  await saveNavRoleDefaults(user, next);
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "configurazione",
    dettaglio: `default visibilità pagine per ruolo ${role}`,
  });
  revalidatePath("/configurazione");
  revalidatePath("/configurazione/visibilita");
  revalidatePath("/operatori");
}
