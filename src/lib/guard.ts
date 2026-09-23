import { NextResponse } from "next/server";
import { getCurrentUser, isCurrentUserPasswordExpired } from "@/lib/auth";
import { assertCan, can, isManutenzione, type Permission, type SessionUser } from "@/lib/permissions";
import type { ModuleId } from "@/lib/platform/modules";
import { getTenantPlatformConfig, tenantHasModule } from "@/lib/platform/tenantProfile";
import { redirect } from "next/navigation";
import type { NavPageId } from "@/lib/navVisibility/catalog";

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

/**
 * Permesso di ruolo oppure sezione menu visibile (default/eccezione).
 * Così un'eccezione di visibilità trasferisce anche l'autorizzazione a lavorare.
 */
async function tenantAllowsNavPage(user: SessionUser, pageId: NavPageId) {
  const { moduleIdForNavPage } = await import("@/lib/navVisibility/catalog");
  const platform = await getTenantPlatformConfig(user.tenantId, user.tenantSlug);
  return tenantHasModule(platform, moduleIdForNavPage(pageId));
}

export async function canPermissionOrNav(
  user: SessionUser,
  permission: Permission
): Promise<boolean> {
  if (can(user, permission)) {
    const { navPagesForPermission } = await import("@/lib/navVisibility/permissionBridge");
    const pages = navPagesForPermission(permission);
    if (pages.length === 0) return true;
    for (const pageId of pages) {
      if (await tenantAllowsNavPage(user, pageId)) return true;
    }
    return false;
  }
  const { navPagesForPermission } = await import("@/lib/navVisibility/permissionBridge");
  const pages = navPagesForPermission(permission);
  if (pages.length === 0) return false;
  const { getEffectiveNavVisibilityForUser } = await import("@/lib/navVisibility");
  const visible = await getEffectiveNavVisibilityForUser(user, user);
  for (const pageId of pages) {
    if (!visible[pageId]) continue;
    if (await tenantAllowsNavPage(user, pageId)) return true;
  }
  return false;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!(await canPermissionOrNav(user, permission))) {
    redirect("/");
  }
  return user;
}

/**
 * Accesso a una pagina: permesso di ruolo oppure eccezione di visibilità.
 * Per le page usare preferibilmente requireNavPage (redirect).
 * Per le server action usare questa (throw).
 */
export async function assertNavPageAccess(pageId: NavPageId) {
  const user = await requireUser();
  const { getEffectiveNavVisibilityForUser } = await import("@/lib/navVisibility");
  const visible = await getEffectiveNavVisibilityForUser(user, user);
  if (!visible[pageId]) throw new Error("Accesso non consentito");
  if (!(await tenantAllowsNavPage(user, pageId))) {
    throw new Error("Modulo non abilitato per questa azienda");
  }
  return user;
}

/**
 * Accesso Recruiting: permesso di ruolo oppure eccezione visibilità pagina.
 */
export async function assertRecruitingAccess() {
  return assertNavPageAccess("recruiting");
}

async function redirectAwayFromHiddenPage(user: SessionUser, pageId: NavPageId) {
  if (user.formazioneOnly) {
    if (pageId === "formazione") {
      redirect("/account");
    }
    const { homePathForUser } = await import("@/lib/formazioneOnlyAccess");
    redirect(homePathForUser(user));
  }
  if (pageId === "home") {
    const { getEffectiveNavVisibilityForUser } = await import("@/lib/navVisibility");
    const visible = await getEffectiveNavVisibilityForUser(user, user);
    const fallback =
      (Object.entries(visible).find(
        ([id, on]) => on && id !== "home" && id !== "account"
      )?.[0] as NavPageId | undefined) ||
      "account";
    const { NAV_PAGES } = await import("@/lib/navVisibility/catalog");
    const href =
      NAV_PAGES.find((p) => p.id === fallback)?.pathPrefix || "/account";
    redirect(href);
  }
  redirect("/");
}

/** Accesso pagina: visibilità ruolo/utente + modulo abilitato per il tenant. */
export async function requireNavPage(pageId: NavPageId) {
  const user = await requireUser();
  const { getEffectiveNavVisibilityForUser } = await import("@/lib/navVisibility");
  const visible = await getEffectiveNavVisibilityForUser(user, user);
  if (!visible[pageId] || !(await tenantAllowsNavPage(user, pageId))) {
    await redirectAwayFromHiddenPage(user, pageId);
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
    if (user.formazioneOnly) redirect("/account");
    redirect("/");
  }
  return user;
}

/** API: 403 se il modulo non è abilitato per il tenant. */
export async function requireApiModule(
  user: SessionUser,
  moduleId: ModuleId
): Promise<NextResponse | null> {
  const platform = await getTenantPlatformConfig(user.tenantId, user.tenantSlug);
  if (!tenantHasModule(platform, moduleId)) {
    return NextResponse.json(
      { error: "Modulo non abilitato per questa azienda" },
      { status: 403 }
    );
  }
  return null;
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

/** Lavoro su sezione: visibilità menu (o permesso) + non manutenzione. */
export async function requireWritableNavPage(pageId: NavPageId) {
  const user = await assertNavPageAccess(pageId);
  assertWritable(user);
  return user;
}

/**
 * Perimetri mandante: ADMIN/AMMINISTRAZIONE, oppure eccezione menu Mandanti
 * (senza il permesso di ruolo “standard” tipo BACK_OFFICE, che resta senza perimetri).
 */
export async function canManageMandantePerimetriWithNav(user: SessionUser) {
  const { canManageMandantePerimetri } = await import("@/lib/permissions");
  if (canManageMandantePerimetri(user)) return true;
  if (can(user, "mandanti:manage")) return false;
  return canPermissionOrNav(user, "mandanti:manage");
}

export { assertCan };
