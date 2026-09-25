/**
 * Registry moduli piattaforma Credixa.
 * Ogni sezione prodotto ha un id tenant: si accende/spegne per azienda
 * (KV `platform.modules`), senza toccare il codice.
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
  "formazione",
  "recruiting",
  "strumenti",
  "utility",
  "utp-npl",
] as const;

export type ModuleId = (typeof PLATFORM_MODULE_IDS)[number];

export const VERTICAL_PROFILES = [
  "RECUPERO_CREDITI",
  "LEGALE",
  "UTILITY",
  "UTP_NPL",
] as const;

export type VerticalProfile = (typeof VERTICAL_PROFILES)[number];

/** Snapshot serializzabile passato al client (menu). */
export type TenantPlatformConfig = {
  verticalProfile: VerticalProfile;
  enabledModules: ModuleId[];
};

/**
 * Sezioni che prima erano agganciate a `core` (sempre visibili).
 * I KV v1 (array) le tengono accese per non togliere funzioni esistenti.
 */
export const NEW_PRODUCT_MODULE_IDS: readonly ModuleId[] = [
  "legale",
  "formazione",
  "recruiting",
  "strumenti",
  "utp-npl",
] as const;

/** Moduli attivi se il tenant non ha ancora una config v2. */
export const RECOVERY_DEFAULT_MODULES: readonly ModuleId[] = [
  "core",
  "recovery",
  "incassi",
  "dialer",
  "affidi",
  "lavorazione",
  ...NEW_PRODUCT_MODULE_IDS,
] as const;

/** Identificatori futuri: nessuna pagina, menu o logica. */
export const FUTURE_MODULE_IDS: readonly ModuleId[] = ["utility"] as const;

/** Moduli vendibili / commutabili per tenant (il core resta sempre). */
export const SELLABLE_MODULE_IDS: readonly ModuleId[] = [
  "recovery",
  "incassi",
  "affidi",
  "lavorazione",
  "dialer",
  "legale",
  "formazione",
  "recruiting",
  "strumenti",
  "utp-npl",
] as const;

export type ModuleCatalogEntry = {
  id: ModuleId;
  label: string;
  description: string;
  locked?: boolean;
  future?: boolean;
};

export const MODULE_CATALOG: readonly ModuleCatalogEntry[] = [
  {
    id: "core",
    label: "Core",
    description: "Home, Account, Agenda, Messaggi, Rubrica, Operatori, Configurazione",
    locked: true,
  },
  {
    id: "recovery",
    label: "Recupero / Pratiche",
    description: "Pratiche, statistiche, provvigioni, registrazioni, import, mandanti",
  },
  {
    id: "incassi",
    label: "Incassi",
    description: "Elenco e registrazione incassi",
  },
  {
    id: "affidi",
    label: "Affidi",
    description: "Assegnazione pratiche agli operatori",
  },
  {
    id: "lavorazione",
    label: "Lavorazione",
    description: "Coda di lavorazione",
  },
  {
    id: "dialer",
    label: "Dialer",
    description: "Predictive dialer e campagne",
  },
  {
    id: "legale",
    label: "Legal",
    description: "Hub giudiziale, valutazione, strategia, agenda legale",
  },
  {
    id: "formazione",
    label: "Formazione",
    description: "Corsi, progressi, role play, warm-up",
  },
  {
    id: "recruiting",
    label: "Recruiting",
    description: "Inserzioni, candidature, colloqui e prove",
  },
  {
    id: "strumenti",
    label: "Strumenti AI",
    description: "Ricerca normativa e strumenti di analisi",
  },
  {
    id: "utp-npl",
    label: "UTP / NPL",
    description: "Acquisto e gestione portafogli, agganciati alle pratiche del tenant",
  },
  { id: "utility", label: "Utility", description: "Non disponibile", future: true },
];

export function isModuleId(value: string): value is ModuleId {
  return (PLATFORM_MODULE_IDS as readonly string[]).includes(value);
}

export function isFutureModule(id: ModuleId): boolean {
  return (FUTURE_MODULE_IDS as readonly string[]).includes(id);
}

function uniqueModuleIds(ids: readonly string[]): ModuleId[] {
  const seen = new Set<ModuleId>();
  const out: ModuleId[] = [];
  for (const raw of ids) {
    if (!isModuleId(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

function withCore(ids: readonly ModuleId[]): ModuleId[] {
  return ids.includes("core") ? [...ids] : ["core", ...ids];
}

/**
 * Normalizza la lista salvata.
 * - oggetto `{ v: 2, modules }` → lista esplicita (si possono spegnere Legal/Formazione/…)
 * - array v1 → tiene le sezioni ex-core accese (nessuna regressione)
 */
export function parseEnabledModules(raw: string | null | undefined): ModuleId[] {
  if (!raw?.trim()) return [...RECOVERY_DEFAULT_MODULES];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const ids = uniqueModuleIds(parsed.map((x) => String(x).trim()));
      if (!ids.length) return [...RECOVERY_DEFAULT_MODULES];
      return withCore(uniqueModuleIds([...ids, ...NEW_PRODUCT_MODULE_IDS]));
    }
    if (parsed && typeof parsed === "object" && "modules" in parsed) {
      const modules = (parsed as { modules: unknown }).modules;
      if (!Array.isArray(modules)) return [...RECOVERY_DEFAULT_MODULES];
      const ids = uniqueModuleIds(modules.map((x) => String(x).trim()));
      return ids.length ? withCore(ids) : [...RECOVERY_DEFAULT_MODULES];
    }
    return [...RECOVERY_DEFAULT_MODULES];
  } catch {
    return [...RECOVERY_DEFAULT_MODULES];
  }
}

export function serializeEnabledModules(ids: readonly string[]): string {
  const list = withCore(uniqueModuleIds(ids));
  return JSON.stringify({ v: 2, modules: list });
}

/**
 * True se il modulo è abilitato per il tenant.
 * Se la lista manca/è vuota → default recovery + sezioni prodotto attuali.
 */
export function hasModule(
  enabledModules: readonly string[] | null | undefined,
  moduleId: ModuleId
): boolean {
  const list = enabledModules?.length ? enabledModules : RECOVERY_DEFAULT_MODULES;
  return list.includes(moduleId);
}
