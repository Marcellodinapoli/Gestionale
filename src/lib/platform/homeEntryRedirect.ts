import { hasModule, type TenantPlatformConfig } from "@/lib/platform/modules";

/**
 * Destinazione quando il tenant non ha il modulo recovery e l’utente apre Home.
 * Allineato a homeDashboard.tsx (redirect add-on verticali).
 * @returns path redirect, o null se Home recovery deve restare visibile
 */
export function homeEntryRedirectWithoutRecovery(
  platform: TenantPlatformConfig
): string | null {
  if (hasModule(platform.enabledModules, "recovery")) {
    return null;
  }
  if (hasModule(platform.enabledModules, "legal-ai")) {
    return "/legal-ai";
  }
  if (hasModule(platform.enabledModules, "legale")) {
    return "/legal";
  }
  if (hasModule(platform.enabledModules, "formazione")) {
    return "/formazione";
  }
  if (hasModule(platform.enabledModules, "recruiting")) {
    return "/recruiting";
  }
  if (hasModule(platform.enabledModules, "dialer")) {
    return "/predictive";
  }
  if (hasModule(platform.enabledModules, "creditcalc")) {
    return "/creditcalc";
  }
  return "/account";
}
