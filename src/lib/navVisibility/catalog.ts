import type { Role } from "@/lib/permissions";

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
  | "formazione"
  | "strumenti"
  | "legal"
  | "recruiting"
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
  /** Non modificabile (sempre visibile se l’utente è loggato). */
  locked?: boolean;
};

export const NAV_PAGES: NavPageDef[] = [
  { id: "home", label: "Home", pathPrefix: "/", group: "main" },
  { id: "pratiche", label: "Pratiche", pathPrefix: "/pratiche", group: "main" },
  { id: "incassi", label: "Incassi", pathPrefix: "/incassi", group: "main" },
  { id: "affidi", label: "Affidi", pathPrefix: "/affidi", group: "main" },
  { id: "agenda", label: "Agenda", pathPrefix: "/agenda", group: "main" },
  { id: "messaggi", label: "Messaggi", pathPrefix: "/messaggi", group: "main" },
  { id: "statistiche", label: "Statistiche", pathPrefix: "/statistiche", group: "main" },
  { id: "provigioni", label: "Provvigioni", pathPrefix: "/provigioni", group: "main" },
  { id: "report", label: "Registrazioni", pathPrefix: "/report", group: "main" },
  { id: "rubrica", label: "Rubrica", pathPrefix: "/rubrica", group: "main" },
  { id: "lavorazione", label: "Lavorazione", pathPrefix: "/lavorazione", group: "main" },
  { id: "dialer", label: "Dialer", pathPrefix: "/predictive-dialer", group: "main" },
  { id: "account", label: "Account", pathPrefix: "/account", group: "main", locked: true },
  { id: "formazione", label: "Formazione", pathPrefix: "/formazione", group: "main" },
  { id: "strumenti", label: "Strumenti AI", pathPrefix: "/strumenti", group: "main" },
  { id: "legal", label: "Legal", pathPrefix: "/legal", group: "main" },
  { id: "recruiting", label: "Recruiting", pathPrefix: "/recruiting", group: "main" },
  { id: "import", label: "Import", pathPrefix: "/import", group: "admin" },
  { id: "mandanti", label: "Mandanti", pathPrefix: "/mandanti", group: "admin" },
  { id: "telefonia", label: "Telefonia", pathPrefix: "/telefonia", group: "admin" },
  { id: "operatori", label: "Operatori", pathPrefix: "/operatori", group: "admin" },
  { id: "sedi", label: "Sedi", pathPrefix: "/sedi", group: "admin" },
  { id: "postazioni", label: "Postazioni", pathPrefix: "/postazioni", group: "admin" },
  { id: "configurazione", label: "Configurazione", pathPrefix: "/configurazione", group: "admin" },
  { id: "log", label: "Log audit", pathPrefix: "/log", group: "admin" },
];

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
