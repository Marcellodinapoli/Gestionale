import "server-only";
import { cache } from "react";
import { configurazioneDbForTenant } from "@/lib/configurazioneRepo";
import { resolveTenantSlugForConnector } from "@/lib/tenant";
import {
  hasModule,
  isModuleId,
  RECOVERY_DEFAULT_MODULES,
  VERTICAL_PROFILES,
  type ModuleId,
  type TenantPlatformConfig,
  type VerticalProfile,
} from "@/lib/platform/modules";

export type { TenantPlatformConfig, VerticalProfile, ModuleId };

export const PLATFORM_VERTICAL_KEY = "platform.vertical";
export const PLATFORM_MODULES_KEY = "platform.modules";
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
  if (!raw?.trim()) return [...RECOVERY_DEFAULT_MODULES];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...RECOVERY_DEFAULT_MODULES];
    const ids = parsed.map((x) => String(x).trim()).filter(isModuleId);
    return ids.length ? ids : [...RECOVERY_DEFAULT_MODULES];
  } catch {
    return [...RECOVERY_DEFAULT_MODULES];
  }
}

/**
 * Profilo piattaforma tenant da ConfigurazioneSistema (KV).
 * Assenza chiavi → RECUPERO_CREDITI + moduli recovery attuali.
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
