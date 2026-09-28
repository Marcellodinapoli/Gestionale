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
  "creditcalc",
] as const;

export type ModuleId = (typeof PLATFORM_MODULE_IDS)[number];

/**
 * Pacchetti commerciali Back Office (accensione/spegnimento sezioni per tenant).
 * - `credixa-full` → tutto
 * - `credixa-base` → gestionale recupero (pratiche, incassi, …)
 * - add-on → solo quella sezione (+ account/core)
 * - nessuno → solo core → schermata “in attesa attivazione”
 */
export const COMMERCIAL_PACKAGE_IDS = [
  "credixa-full",
  "credixa-base",
  "recruiting",
  "formazione",
  "dialer",
  "legale",
  "creditcalc",
] as const;

export type CommercialPackageId = (typeof COMMERCIAL_PACKAGE_IDS)[number];

export type CommercialPackageEntry = {
  id: CommercialPackageId;
  label: string;
  description: string;
};

export const COMMERCIAL_PACKAGE_CATALOG: readonly CommercialPackageEntry[] = [
  {
    id: "credixa-full",
    label: "Credixa full",
    description: "Attiva tutte le sezioni del gestionale",
  },
  {
    id: "credixa-base",
    label: "Credixa base",
    description: "Pratiche, incassi, affidi, lavorazione, UTP/NPL",
  },
  {
    id: "recruiting",
    label: "Recruiter",
    description: "Recruiting: offerte, candidature, colloqui",
  },
  {
    id: "formazione",
    label: "Formazione",
    description: "Corsi, progressi, role play, warm-up e Strumenti AI",
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
    id: "creditcalc",
    label: "CreditCalc",
    description: "Accesso CreditCalc dal gestionale",
  },
] as const;

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

/** Credixa base: gestionale recupero (senza add-on commerciali). */
export const BASE_GESTIONALE_MODULES: readonly ModuleId[] = [
  "core",
  "recovery",
  "incassi",
  "affidi",
  "lavorazione",
  "utp-npl",
] as const;

/** Credixa full = tutto tranne moduli future. */
export const CREDIXA_FULL_MODULES: readonly ModuleId[] = PLATFORM_MODULE_IDS.filter(
  (id) => !(FUTURE_MODULE_IDS as readonly string[]).includes(id)
);

/** Moduli prodotto (oltre a core): se nessuno → azienda in attesa attivazione. */
export const PRODUCT_MODULE_IDS: readonly ModuleId[] = [
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
  "creditcalc",
] as const;

/** Moduli vendibili / commutabili per tenant (il core resta sempre). */
export const SELLABLE_MODULE_IDS: readonly ModuleId[] = [...PRODUCT_MODULE_IDS];

/** Add-on singoli (non includono Credixa base/full). */
export const PACKAGE_ADDON_MODULES: Record<
  Exclude<CommercialPackageId, "credixa-full" | "credixa-base">,
  readonly ModuleId[]
> = {
  recruiting: ["recruiting"],
  formazione: ["formazione", "strumenti"],
  dialer: ["dialer"],
  legale: ["legale"],
  creditcalc: ["creditcalc"],
};

/** Nessuna sezione prodotto attiva → schermata in attesa. */
export function isAwaitingSectionActivation(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (enabledModules == null) return false;
  return !enabledModules.some((m) =>
    (PRODUCT_MODULE_IDS as readonly string[]).includes(m)
  );
}

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
    description: "Corsi, progressi, role play, warm-up e Strumenti AI",
  },
  {
    id: "recruiting",
    label: "Recruiting",
    description: "Inserzioni, candidature, colloqui e prove",
  },
  {
    id: "strumenti",
    label: "Strumenti AI",
    description: "Ricerca normativa e strumenti di analisi (incluso in Formazione)",
  },
  {
    id: "utp-npl",
    label: "UTP / NPL",
    description: "Acquisto e gestione portafogli, agganciati alle pratiche del tenant",
  },
  {
    id: "creditcalc",
    label: "CreditCalc",
    description: "Voce CreditCalc e accesso app collegata",
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

/** Strumenti AI segue Formazione: senza formazione non resta attivo da solo. */
function syncFormazioneStrumenti(ids: readonly ModuleId[]): ModuleId[] {
  const set = new Set(ids);
  if (set.has("formazione")) set.add("strumenti");
  else set.delete("strumenti");
  return [...set];
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
      return withCore(
        syncFormazioneStrumenti(uniqueModuleIds([...ids, ...NEW_PRODUCT_MODULE_IDS]))
      );
    }
    if (parsed && typeof parsed === "object" && "modules" in parsed) {
      const modules = (parsed as { modules: unknown }).modules;
      if (!Array.isArray(modules)) return [...RECOVERY_DEFAULT_MODULES];
      const ids = uniqueModuleIds(modules.map((x) => String(x).trim()));
      return ids.length
        ? withCore(syncFormazioneStrumenti(ids))
        : [...RECOVERY_DEFAULT_MODULES];
    }
    return [...RECOVERY_DEFAULT_MODULES];
  } catch {
    return [...RECOVERY_DEFAULT_MODULES];
  }
}

export function serializeEnabledModules(ids: readonly string[]): string {
  const list = withCore(syncFormazioneStrumenti(uniqueModuleIds(ids)));
  return JSON.stringify({ v: 2, modules: list });
}

/**
 * True se il modulo è abilitato per il tenant.
 * - `null`/`undefined` → default recovery (tenant senza config piattaforma).
 * - `strumenti` → attivo solo con Formazione.
 * - `creditcalc` → solo se esplicitamente in lista (mai implicito dal default recovery).
 */
export function hasModule(
  enabledModules: readonly string[] | null | undefined,
  moduleId: ModuleId
): boolean {
  if (enabledModules == null) {
    return RECOVERY_DEFAULT_MODULES.includes(moduleId);
  }
  if (moduleId === "strumenti") {
    return enabledModules.includes("formazione");
  }
  return enabledModules.includes(moduleId);
}

export function isCommercialPackageId(value: string): value is CommercialPackageId {
  return (COMMERCIAL_PACKAGE_IDS as readonly string[]).includes(value);
}

/** Deduce quali pacchetti commerciali risultano accesi dalla lista moduli. */
export function packagesFromModules(
  enabledModules: readonly string[] | null | undefined
): CommercialPackageId[] {
  const list = enabledModules?.length
    ? enabledModules
    : RECOVERY_DEFAULT_MODULES;
  const out: CommercialPackageId[] = [];
  const fullOn = CREDIXA_FULL_MODULES.every((m) => list.includes(m));
  if (fullOn) {
    out.push("credixa-full");
  }
  const baseOn = BASE_GESTIONALE_MODULES.every((m) => list.includes(m));
  if (baseOn && !fullOn) {
    out.push("credixa-base");
  }
  for (const id of COMMERCIAL_PACKAGE_IDS) {
    if (id === "credixa-full" || id === "credixa-base") continue;
    const addons = PACKAGE_ADDON_MODULES[id];
    if (addons.every((m) => list.includes(m))) out.push(id);
  }
  return out;
}

/**
 * Da pacchetti commerciali → lista moduli.
 * - nessuno → solo `core` (in attesa attivazione)
 * - Credixa full → tutto
 * - Credixa base → gestionale recupero
 * - add-on soli → core + quelle sezioni (senza base automatica)
 */
export function modulesFromPackages(
  packages: readonly string[]
): ModuleId[] {
  const ids = packages
    .map((p) => String(p).trim())
    .filter(isCommercialPackageId);
  if (ids.includes("credixa-full")) {
    return withCore([...CREDIXA_FULL_MODULES]);
  }
  const set = new Set<ModuleId>();
  if (ids.includes("credixa-base")) {
    for (const m of BASE_GESTIONALE_MODULES) set.add(m);
  }
  for (const id of ids) {
    if (id === "credixa-full" || id === "credixa-base") continue;
    for (const m of PACKAGE_ADDON_MODULES[id]) set.add(m);
  }
  return withCore([...set]);
}
