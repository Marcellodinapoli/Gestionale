import { can, canManageSedi, type Role, type SessionUser } from "@/lib/permissions";
import {
  NAV_PAGES,
  type NavPageId,
  type NavVisibilityMap,
  type NavRoleDefaults,
} from "@/lib/navVisibility/catalog";

/**
 * Baseline = comportamento attuale del menu (permission + formazioneOnly).
 * Usata come default se l’admin non ha ancora salvato preferenze.
 */
export function baselineNavVisibility(
  user: Pick<SessionUser, "role" | "formazioneOnly">
): Record<NavPageId, boolean> {
  const u = user as SessionUser;
  const out = {} as Record<NavPageId, boolean>;
  for (const page of NAV_PAGES) {
    out[page.id] = baselinePageVisible(u, page.id);
  }
  return out;
}

export function baselinePageVisible(
  user: Pick<SessionUser, "role" | "formazioneOnly">,
  pageId: NavPageId
): boolean {
  const u = user as SessionUser;
  if (pageId === "account" || pageId === "creditcalc") return true;
  if (user.role === "MANUTENZIONE") return true;

  switch (pageId) {
    case "home":
    case "pratiche":
    case "rubrica":
      return !user.formazioneOnly;
    case "incassi":
      return !user.formazioneOnly && can(u, "incassi:list");
    case "affidi":
      return !user.formazioneOnly && can(u, "pratiche:assign");
    case "agenda":
    case "messaggi":
      return !user.formazioneOnly && can(u, "agenda:view");
    case "statistiche":
      return !user.formazioneOnly && can(u, "statistiche:view");
    case "provigioni":
      return !user.formazioneOnly && can(u, "provigioni:view");
    case "report":
      return !user.formazioneOnly && can(u, "report:view");
    case "lavorazione":
      return !user.formazioneOnly && can(u, "lavorazione:view");
    case "dialer":
      return !user.formazioneOnly && can(u, "dialer:operate");
    case "formazione":
      return can(u, "formazione:view");
    case "strumenti":
      return !user.formazioneOnly && can(u, "strumenti:view");
    case "legal":
      return !user.formazioneOnly && can(u, "legal:view");
    case "recruiting":
      return !user.formazioneOnly && can(u, "recruiting:view");
    case "portafogli":
      return !user.formazioneOnly && can(u, "portafogli:view");
    case "import":
      return can(u, "import:run");
    case "mandanti":
      return can(u, "mandanti:manage");
    case "telefonia":
      return can(u, "telephony:manage");
    case "operatori":
    case "postazioni":
      return can(u, "operatori:manage");
    case "sedi":
      return canManageSedi(u);
    case "configurazione":
      return can(u, "users:manage");
    case "log":
      return can(u, "audit:view");
    case "account":
    case "creditcalc":
      return true;
    default:
      return false;
  }
}

/** Default di sistema per un ruolo (senza override config). */
export function systemRoleNavDefaults(role: Role): Record<NavPageId, boolean> {
  return baselineNavVisibility({ role, formazioneOnly: false });
}

/** Matrice completa ruoli × pagine dai default di sistema. */
export function systemAllRoleDefaults(): NavRoleDefaults {
  const roles: Role[] = [
    "ADMIN",
    "AMMINISTRAZIONE",
    "SUPERVISOR",
    "BACK_OFFICE",
    "OPERATOR",
    "LEGAL",
  ];
  const out: NavRoleDefaults = {};
  for (const role of roles) {
    out[role] = systemRoleNavDefaults(role);
  }
  return out;
}

export function mergeRoleDefaults(
  saved: NavRoleDefaults | null | undefined
): NavRoleDefaults {
  const base = systemAllRoleDefaults();
  if (!saved) return base;
  for (const role of Object.keys(base) as Role[]) {
    const patch = saved[role];
    if (!patch) continue;
    base[role] = { ...base[role], ...patch };
  }
  return base;
}

export function resolveEffectiveNavVisibility(input: {
  role: Role;
  formazioneOnly?: boolean;
  roleDefaults?: NavRoleDefaults | null;
  userOverrides?: NavVisibilityMap | null;
}): Record<NavPageId, boolean> {
  if (input.role === "MANUTENZIONE") {
    return baselineNavVisibility({ role: "MANUTENZIONE", formazioneOnly: false });
  }

  const roleMap =
    mergeRoleDefaults(input.roleDefaults)[input.role] ||
    systemRoleNavDefaults(input.role);

  const out = {} as Record<NavPageId, boolean>;
  for (const page of NAV_PAGES) {
    if (page.locked || page.id === "account" || page.id === "creditcalc") {
      out[page.id] = true;
      continue;
    }
    if (input.formazioneOnly) {
      // Formazione-only: solo formazione (+ account locked).
      out[page.id] = page.id === "formazione";
      continue;
    }
    const override = input.userOverrides?.[page.id];
    if (typeof override === "boolean") {
      out[page.id] = override;
      continue;
    }
    out[page.id] = roleMap[page.id] ?? baselinePageVisible(
      { role: input.role, formazioneOnly: false },
      page.id
    );
  }
  return out;
}
