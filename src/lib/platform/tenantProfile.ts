import "server-only";
import { cache } from "react";
import { configurazioneDbForTenant } from "@/lib/configurazioneRepo";
import { resolveTenantSlugForConnector } from "@/lib/tenant";
import {
  hasModule,
  modulesFromPackages,
  parseEnabledModules,
  RECOVERY_DEFAULT_MODULES,
  VERTICAL_PROFILES,
  type ModuleId,
  type TenantPlatformConfig,
  type VerticalProfile,
} from "@/lib/platform/modules";

export type { TenantPlatformConfig, VerticalProfile, ModuleId };

export const PLATFORM_VERTICAL_KEY = "platform.vertical";
export const PLATFORM_MODULES_KEY = "platform.modules";
/** Pacchetti commerciali BO (fonte UI); se assente si deducono dai moduli. */
export const PLATFORM_PACKAGES_KEY = "platform.packages";
/** Fine monitoraggio performance (ISO UTC); assente = illimitato se flag ON. */
export const PLATFORM_PERF_UNTIL_KEY = "platform.perfMonitoringUntil";
export const PLATFORM_CONFIG_CATEGORIA = "platform";

const DEFAULT_CONFIG: TenantPlatformConfig = {
  verticalProfile: "RECUPERO_CREDITI",
  enabledModules: [...RECOVERY_DEFAULT_MODULES],
};

function parseVertical(raw: string | null | undefined): VerticalProfile {
  const v = String(raw || "").trim().toUpperCase();
  if ((VERTICAL_PROFILES as readonly string[]).includes(v)) {
    return v as VerticalProfile;
  }
  return "RECUPERO_CREDITI";
}

function parseModules(raw: string | null | undefined): ModuleId[] {
  return parseEnabledModules(raw);
}

function parsePackagesRaw(raw: string | null | undefined): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * I moduli piattaforma sono scritti dal Back Office su Neon
 * (`ConfigurazioneSistema` / `platform.modules`). Il prisma operativo
 * (Firebase/connector) non li vede → senza questa lettura la nav resta
 * sul default “tutto acceso”.
 * Priorità: `platform.packages` (fonte BO) → `platform.modules`.
 */
async function loadPlatformConfigFromNeon(
  tenantId: string
): Promise<TenantPlatformConfig | null> {
  const { isNeonConfigured } = await import("@/lib/neon/client");
  if (!isNeonConfigured()) return null;

  const { neonQuery } = await import("@/lib/neon/pool");
  const rows = await neonQuery(
    `SELECT "Chiave", "Valore"
     FROM "ConfigurazioneSistema"
     WHERE "TenantId" = $1::uuid
       AND "Chiave" IN ($2, $3, $4)`,
    [
      tenantId,
      PLATFORM_MODULES_KEY,
      PLATFORM_VERTICAL_KEY,
      PLATFORM_PACKAGES_KEY,
    ]
  ).catch(() => [] as Record<string, unknown>[]);

  if (!rows.length) return null;

  const map = new Map<string, string>();
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const k = String(row.Chiave ?? row.chiave ?? "");
    const v = String(row.Valore ?? row.valore ?? "");
    if (k) map.set(k, v);
  }

  const hasVertical = map.has(PLATFORM_VERTICAL_KEY);
  const hasModules = map.has(PLATFORM_MODULES_KEY);
  const packages = parsePackagesRaw(map.get(PLATFORM_PACKAGES_KEY));
  if (!hasVertical && !hasModules && !packages) return null;

  const enabledModules =
    packages != null
      ? modulesFromPackages(packages)
      : hasModules
        ? parseModules(map.get(PLATFORM_MODULES_KEY))
        : [...RECOVERY_DEFAULT_MODULES];

  return {
    verticalProfile: parseVertical(map.get(PLATFORM_VERTICAL_KEY)),
    enabledModules,
  };
}

/**
 * Profilo piattaforma tenant.
 * Priorità: Neon (fonte Back Office) → ConfigurazioneSistema operativa.
 */
export const getTenantPlatformConfig = cache(
  async function getTenantPlatformConfig(
    tenantId?: string | null,
    tenantSlug?: string | null
  ): Promise<TenantPlatformConfig> {
    if (!tenantId) {
      return { ...DEFAULT_CONFIG, enabledModules: [...RECOVERY_DEFAULT_MODULES] };
    }

    try {
      const fromNeon = await loadPlatformConfigFromNeon(tenantId);
      if (fromNeon) return fromNeon;
    } catch {
      // fallback sotto
    }

    try {
      const slug = await resolveTenantSlugForConnector(tenantId, tenantSlug);
      const db = configurazioneDbForTenant(tenantId, slug);
      const rows = await db.findMany({
        where: {
          tenantId,
          chiave: { in: [PLATFORM_VERTICAL_KEY, PLATFORM_MODULES_KEY] },
        },
        select: { chiave: true, valore: true },
      });
      const map = new Map(rows.map((r) => [r.chiave, r.valore]));
      const hasVertical = map.has(PLATFORM_VERTICAL_KEY);
      const hasModules = map.has(PLATFORM_MODULES_KEY);
      if (!hasVertical && !hasModules) {
        return { ...DEFAULT_CONFIG, enabledModules: [...RECOVERY_DEFAULT_MODULES] };
      }
      return {
        verticalProfile: parseVertical(map.get(PLATFORM_VERTICAL_KEY)),
        enabledModules: parseModules(map.get(PLATFORM_MODULES_KEY)),
      };
    } catch {
      return { ...DEFAULT_CONFIG, enabledModules: [...RECOVERY_DEFAULT_MODULES] };
    }
  }
);

export function tenantHasModule(
  config: TenantPlatformConfig,
  moduleId: ModuleId
): boolean {
  return hasModule(config.enabledModules, moduleId);
}
