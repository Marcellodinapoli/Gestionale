import type { Role } from "@/lib/permissions";
import type { ModuleId } from "@/lib/platform/modules";

/** Id stabile delle voci di menu (main + admin). */
export type NavPageId =
  | "home"
  | "pratiche"
  | "incassi"
  | "affidi"
  | "agenda"
  | "messaggi"
  | "statistiche"
  | "provigioni"
  | "report"
  | "rubrica"
  | "lavorazione"
  | "dialer"
  | "account"
  | "creditcalc"
  | "formazione"
  | "strumenti"
  | "legal"
  | "recruiting"
  | "portafogli"
  | "import"
  | "mandanti"
  | "telefonia"
  | "operatori"
  | "sedi"
  | "postazioni"
  | "configurazione"
  | "log";

export type NavPageDef = {
  id: NavPageId;
  label: string;
  /** Prefisso path per match (es. /report). */
  pathPrefix: string;
  group: "main" | "admin";
  /** Modulo tenant che deve essere acceso per questa pagina. */
  moduleId: ModuleId;
  /** Non modificabile (sempre visibile se l’utente è loggato). */
  locked?: boolean;
};

export const NAV_PAGES: NavPageDef[] = [
  { id: "home", label: "Home", pathPrefix: "/", group: "main", moduleId: "core" },
  { id: "pratiche", label: "Pratiche", pathPrefix: "/pratiche", group: "main", moduleId: "recovery" },
  { id: "incassi", label: "Incassi", pathPrefix: "/incassi", group: "main", moduleId: "incassi" },
  { id: "affidi", label: "Affidi", pathPrefix: "/affidi", group: "main", moduleId: "affidi" },
  { id: "agenda", label: "Agenda", pathPrefix: "/agenda", group: "main", moduleId: "core" },
  { id: "messaggi", label: "Messaggi", pathPrefix: "/messaggi", group: "main", moduleId: "core" },
  { id: "statistiche", label: "Statistiche", pathPrefix: "/statistiche", group: "main", moduleId: "recovery" },
  { id: "provigioni", label: "Provvigioni", pathPrefix: "/provigioni", group: "main", moduleId: "recovery" },
  { id: "report", label: "Registrazioni", pathPrefix: "/report", group: "main", moduleId: "recovery" },
  { id: "rubrica", label: "Rubrica", pathPrefix: "/rubrica", group: "main", moduleId: "core" },
  { id: "lavorazione", label: "Lavorazione", pathPrefix: "/lavorazione", group: "main", moduleId: "lavorazione" },
  { id: "dialer", label: "Dialer", pathPrefix: "/predictive-dialer", group: "main", moduleId: "dialer" },
  { id: "account", label: "Account", pathPrefix: "/account", group: "main", moduleId: "core", locked: true },
  { id: "creditcalc", label: "CreditCalc", pathPrefix: "/creditcalc", group: "main", moduleId: "core", locked: true },
  { id: "formazione", label: "Formazione", pathPrefix: "/formazione", group: "main", moduleId: "formazione" },
  { id: "strumenti", label: "Strumenti AI", pathPrefix: "/strumenti", group: "main", moduleId: "strumenti" },
  { id: "legal", label: "Legal", pathPrefix: "/legal", group: "main", moduleId: "legale" },
  { id: "recruiting", label: "Recruiting", pathPrefix: "/recruiting", group: "main", moduleId: "recruiting" },
  { id: "portafogli", label: "Portafogli", pathPrefix: "/portafogli", group: "main", moduleId: "utp-npl" },
  { id: "import", label: "Import", pathPrefix: "/import", group: "admin", moduleId: "recovery" },
  { id: "mandanti", label: "Mandanti", pathPrefix: "/mandanti", group: "admin", moduleId: "recovery" },
  { id: "telefonia", label: "Telefonia", pathPrefix: "/telefonia", group: "admin", moduleId: "core" },
  { id: "operatori", label: "Operatori", pathPrefix: "/operatori", group: "admin", moduleId: "core" },
  { id: "sedi", label: "Sedi", pathPrefix: "/sedi", group: "admin", moduleId: "core" },
  { id: "postazioni", label: "Postazioni", pathPrefix: "/postazioni", group: "admin", moduleId: "core" },
  { id: "configurazione", label: "Configurazione", pathPrefix: "/configurazione", group: "admin", moduleId: "core" },
  { id: "log", label: "Log audit", pathPrefix: "/log", group: "admin", moduleId: "core" },
];

export function moduleIdForNavPage(pageId: NavPageId): ModuleId {
  return NAV_PAGES.find((p) => p.id === pageId)?.moduleId ?? "core";
}

export const NAV_PAGE_IDS = NAV_PAGES.map((p) => p.id);

/** Ruoli configurabili in matrice (escluso Manutenzione = vede tutto). */
export const NAV_VISIBILITY_ROLES: Role[] = [
  "ADMIN",
  "AMMINISTRAZIONE",
  "SUPERVISOR",
  "BACK_OFFICE",
  "OPERATOR",
  "LEGAL",
];

export const NAV_ROLE_DEFAULTS_KEY = "nav.visibility.roleDefaults";
export const NAV_USER_OVERRIDES_KEY = "nav.visibility.userOverrides";

export type NavVisibilityMap = Partial<Record<NavPageId, boolean>>;
export type NavRoleDefaults = Partial<Record<Role, NavVisibilityMap>>;
export type NavUserOverrides = Record<string, NavVisibilityMap>;

export function navPageByHref(href: string): NavPageDef | undefined {
  if (href === "/") return NAV_PAGES.find((p) => p.id === "home");
  return NAV_PAGES.filter((p) => p.id !== "home")
    .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)
    .find((p) => href === p.pathPrefix || href.startsWith(`${p.pathPrefix}/`));
}

export function navPageByPathname(pathname: string): NavPageDef | undefined {
  return navPageByHref(pathname);
}
