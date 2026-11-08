import { hasModule } from "@/lib/platform/modules";
import {
  isLegalAiStandaloneTenant,
  isRecruitingStandaloneTenant,
} from "@/lib/platform/addonOnlyTenantNav";
import { isFormazioneStandaloneTenant } from "@/lib/platform/formazioneProduct";

/** Tenant con Predictive attivo e senza modulo recovery (add-on o mix senza base). */
export function isDialerStandaloneTenant(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!enabledModules?.length) return false;
  return (
    hasModule(enabledModules, "dialer") && !hasModule(enabledModules, "recovery")
  );
}

/**
 * Prodotto commerciale **solo Predictive**: nessun altro add-on prodotto (Recruiter, Legal AI, Formazione).
 * Invito Platform ADMIN; gerarchia Admin / Supervisor / Operatore; postazioni richieste al login.
 */
export function isDialerProductTenant(
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!isDialerStandaloneTenant(enabledModules)) return false;
  if (isRecruitingStandaloneTenant(enabledModules)) return false;
  if (isLegalAiStandaloneTenant(enabledModules)) return false;
  if (isFormazioneStandaloneTenant(enabledModules)) return false;
  return true;
}

export function dialerProductInvitePolicy(): {
  defaultRole: string;
  allowedRoles: string[];
  invalidRoleMessage: string;
} {
  return {
    defaultRole: "ADMIN",
    allowedRoles: ["ADMIN"],
    invalidRoleMessage:
      "Su Credixa Predictive l'invito supporta solo il ruolo ADMIN",
  };
}

export function supervisorCanManageOperatoriDialer(
  user: { role: string } | null | undefined,
  enabledModules: readonly string[] | null | undefined
): boolean {
  if (!user || user.role !== "SUPERVISOR") return false;
  return isDialerProductTenant(enabledModules);
}
