/**
 * Registry moduli piattaforma Credixa.
 * Oggi solo i moduli recovery sono utilizzabili; i futuri sono solo identificatori.
 * (Safe per client e server — nessun I/O.)
 */

export const PLATFORM_MODULE_IDS = [
  "core",
  "recovery",
  "incassi",
  "dialer",
  "affidi",
  "lavorazione",
  "legale",
  "broker",
  "utility",
  "utp-npl",
] as const;

export type ModuleId = (typeof PLATFORM_MODULE_IDS)[number];

export const VERTICAL_PROFILES = [
  "RECUPERO_CREDITI",
  "LEGALE",
  "BROKER",
  "UTILITY",
  "UTP_NPL",
] as const;

export type VerticalProfile = (typeof VERTICAL_PROFILES)[number];

/** Snapshot serializzabile passato al client (menu). */
export type TenantPlatformConfig = {
  verticalProfile: VerticalProfile;
  enabledModules: ModuleId[];
};

/** Moduli attivi per il profilo RECUPERO_CREDITI (comportamento attuale). */
export const RECOVERY_DEFAULT_MODULES: readonly ModuleId[] = [
  "core",
  "recovery",
  "incassi",
  "dialer",
  "affidi",
  "lavorazione",
] as const;

/** Identificatori futuri: nessuna pagina, menu o logica. */
export const FUTURE_MODULE_IDS: readonly ModuleId[] = [
  "legale",
  "broker",
  "utility",
  "utp-npl",
] as const;

export function isModuleId(value: string): value is ModuleId {
  return (PLATFORM_MODULE_IDS as readonly string[]).includes(value);
}

export function isFutureModule(id: ModuleId): boolean {
  return (FUTURE_MODULE_IDS as readonly string[]).includes(id);
}

/**
 * True se il modulo è abilitato per il tenant.
 * Se la lista manca/è vuota → default recovery (nessuna regressione).
 */
export function hasModule(
  enabledModules: readonly string[] | null | undefined,
  moduleId: ModuleId
): boolean {
  const list = enabledModules?.length ? enabledModules : RECOVERY_DEFAULT_MODULES;
  return list.includes(moduleId);
}
