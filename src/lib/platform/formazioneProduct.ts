import { hasModule } from "@/lib/platform/modules";
import {
  isLegalAiStandaloneTenant,
  isRecruitingStandaloneTenant,
} from "@/lib/platform/addonOnlyTenantNav";

/** Tenant con Formazione attiva e senza modulo recovery (add-on o mix senza base). */
export function isFormazioneStandaloneTenant(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!enabledModules?.length) return false;
  return (
    hasModule(enabledModules, "formazione") && !hasModule(enabledModules, "recovery")
  );
}

/**
 * Prodotto commerciale **solo Formazione** (+ Strumenti AI): nessun Recruiter/Legal AI standalone.
 * Su questi tenant: invito Platform ADMIN, gerarchia Admin/Supervisor/Operatore, niente postazioni.
 */
export function isFormazioneProductTenant(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!isFormazioneStandaloneTenant(enabledModules)) return false;
  if (isRecruitingStandaloneTenant(enabledModules)) return false;
  if (isLegalAiStandaloneTenant(enabledModules)) return false;
  return true;
}

export function formazioneProductInvitePolicy(): {
  defaultRole: string;
  allowedRoles: string[];
  invalidRoleMessage: string;
} {
  return {
    defaultRole: "ADMIN",
    allowedRoles: ["ADMIN"],
    invalidRoleMessage:
      "Su Credixa Formazione l'invito supporta solo il ruolo ADMIN",
  };
}

/** Nessuna selezione postazione al login per il prodotto Formazione standalone. */
export function tenantSkipsPostazione(
  enabledModules: readonly string[] | null | undefined
): boolean {
  return isFormazioneProductTenant(enabledModules);
}

export function supervisorCanManageOperatoriFormazione(
  user: { role: string } | null | undefined,
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!user || user.role !== "SUPERVISOR") return false;
  return isFormazioneProductTenant(enabledModules);
}

/** Voci amministrazione add-on senza Postazioni (solo prodotto Formazione). */
export function addonAdminHrefsExcludingPostazioni(
  base: ReadonlySet<string>
): Set<string> {
  const out = new Set(base);
  out.delete("/postazioni");
  return out;
}
