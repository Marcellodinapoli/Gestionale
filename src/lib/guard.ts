import { NextResponse } from "next/server";
import { getCurrentUser, isCurrentUserPasswordExpired } from "@/lib/auth";
import { assertCan, can, isManutenzione, type Permission, type SessionUser } from "@/lib/permissions";
import type { ModuleId } from "@/lib/platform/modules";
import { getTenantPlatformConfig, tenantHasModule } from "@/lib/platform/tenantProfile";
import { redirect } from "next/navigation";

type RequireUserOptions = {
  /** Consente l'accesso solo per cambio password obbligatorio o logout. */
  allowExpiredPassword?: boolean;
};

async function assertPasswordFresh(allowExpiredPassword?: boolean) {
  if (allowExpiredPassword) return;
  if (await isCurrentUserPasswordExpired()) {
    redirect("/cambia-password");
  }
}

export async function requireUser(options?: RequireUserOptions) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await assertPasswordFresh(options?.allowExpiredPassword);
  return user;
}

/** Autenticazione API: blocca sessioni con password scaduta (403). */
export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (await isCurrentUserPasswordExpired()) {
    return NextResponse.json(
      { error: "Password scaduta: aggiornala per continuare" },
      { status: 403 }
    );
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user, permission)) {
    redirect("/");
  }
  return user;
}

/** Accesso pagina basato su preferenze visibilità (default ruolo + eccezioni). */
export async function requireNavPage(pageId: import("@/lib/navVisibility/catalog").NavPageId) {
  const user = await requireUser();
  const { getEffectiveNavVisibilityForUser } = await import("@/lib/navVisibility");
  const visible = await getEffectiveNavVisibilityForUser(user, user);
  if (!visible[pageId]) {
    if (user.formazioneOnly) {
      const { homePathForUser } = await import("@/lib/formazioneOnlyAccess");
      redirect(homePathForUser(user));
    }
    // Evita loop se Home stessa non è visibile.
    if (pageId === "home") {
      const fallback =
        (Object.entries(visible).find(
          ([id, on]) => on && id !== "home" && id !== "account"
        )?.[0] as import("@/lib/navVisibility/catalog").NavPageId | undefined) ||
        "account";
      const { NAV_PAGES } = await import("@/lib/navVisibility/catalog");
      const href =
        NAV_PAGES.find((p) => p.id === fallback)?.pathPrefix || "/account";
      redirect(href);
    }
    redirect("/");
  }
  return user;
}

/**
 * Blocca l'accesso se il modulo non è abilitato per il tenant.
 * Default tenant senza config KV = moduli recovery → nessun cambio di comportamento.
 */
export async function requireModule(moduleId: ModuleId) {
  const user = await requireUser();
  const platform = await getTenantPlatformConfig(user.tenantId, user.tenantSlug);
  if (!tenantHasModule(platform, moduleId)) {
    redirect("/");
  }
  return user;
}

function assertWritable(user: Awaited<ReturnType<typeof requireUser>>) {
  if (isManutenzione(user)) {
    throw new Error(
      "Account manutenzione: sola consultazione della struttura, senza dati operativi"
    );
  }
}

export async function requireWritableUser() {
  const user = await requireUser();
  assertWritable(user);
  return user;
}

export async function requireWritablePermission(permission: Permission) {
  const user = await requirePermission(permission);
  assertWritable(user);
  return user;
}

export { assertCan };
