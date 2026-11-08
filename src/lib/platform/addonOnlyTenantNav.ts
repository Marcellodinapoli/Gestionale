import { hasModule, type ModuleId } from "@/lib/platform/modules";

/**
 * Tenant senza Credixa base/recovery: solo add-on (Recruiting, Legal AI, …) + core.
 */
export function isAddonOnlyTenant(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!enabledModules?.length) return false;
  return !hasModule(enabledModules, "recovery");
}

/** Voci amministrazione raggiungibili senza modulo recovery (Operatori, Configurazione, …). */
export const ADDON_ONLY_ADMIN_HREFS = new Set<string>([
  "/operatori",
  "/postazioni",
  "/sedi",
  "/configurazione",
  "/log",
  "/ticket",
  "/telefonia",
]);

const ADDON_MAIN_NAV: readonly { moduleId: ModuleId; href: string }[] = [
  { moduleId: "legal-ai", href: "/legal-ai" },
  { moduleId: "recruiting", href: "/recruiting" },
  { moduleId: "formazione", href: "/formazione/progressi" },
  { moduleId: "strumenti", href: "/strumenti/ricerca-normativa" },
  { moduleId: "legale", href: "/legal" },
  { moduleId: "dialer", href: "/predictive" },
  { moduleId: "creditcalc", href: "/creditcalc" },
];

/**
 * Menu principale ridotto per tenant add-on only: Account + sezioni prodotto accese.
 * `null` se il tenant ha recovery (menu completo).
 */
export function addonOnlyMainNavHrefs(
  enabledModules: readonly string[] | null | undefined
): Set<string> | null {
  if (!isAddonOnlyTenant(enabledModules)) return null;
  const hrefs = new Set<string>(["/account"]);
  for (const { moduleId, href } of ADDON_MAIN_NAV) {
    if (hasModule(enabledModules, moduleId)) hrefs.add(href);
  }
  return hrefs.size > 1 ? hrefs : hrefs;
}

export function isRecruitingStandaloneTenant(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!enabledModules?.length) return false;
  return (
    hasModule(enabledModules, "recruiting") && !hasModule(enabledModules, "recovery")
  );
}

export function isLegalAiStandaloneTenant(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!enabledModules?.length) return false;
  return (
    hasModule(enabledModules, "legal-ai") && !hasModule(enabledModules, "recovery")
  );
}
