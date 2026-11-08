import type { Role } from "@/lib/permissions";
import { hasModule } from "@/lib/platform/modules";
import {
  isLegalAiStandaloneTenant,
  isRecruitingStandaloneTenant,
} from "@/lib/platform/addonOnlyTenantNav";
import {
  formazioneProductInvitePolicy,
  isFormazioneProductTenant,
} from "@/lib/platform/formazioneProduct";
import {
  dialerProductInvitePolicy,
  isDialerProductTenant,
} from "@/lib/platform/dialerProduct";

export type ProductStandaloneContext = {
  legalAi: boolean;
  recruiting: boolean;
  /** Prodotto commerciale solo Formazione (+ Strumenti AI), senza recovery. */
  formazione: boolean;
  /** Prodotto commerciale solo Predictive, senza recovery. */
  dialer: boolean;
};

export function getProductStandaloneContext(
  enabledModules: readonly string[] | null | undefined
): ProductStandaloneContext {
  return {
    legalAi: isLegalAiStandaloneTenant(enabledModules),
    recruiting: isRecruitingStandaloneTenant(enabledModules),
    formazione: isFormazioneProductTenant(enabledModules),
    dialer: isDialerProductTenant(enabledModules),
  };
}

export function standaloneOperatoreRoles(ctx: ProductStandaloneContext): Role[] {
  const out: Role[] = [];
  if (ctx.recruiting) out.push("RECRUITER");
  if (ctx.legalAi) out.push("AVVOCATO");
  return out;
}

export type PlatformInvitePolicy = {
  defaultRole: string;
  allowedRoles: string[];
  invalidRoleMessage: string;
};

export function resolvePlatformInvitePolicy(
  enabledModules: readonly string[] | null | undefined
): PlatformInvitePolicy {
  if (hasModule(enabledModules, "recovery")) {
    return {
      defaultRole: "ADMIN",
      allowedRoles: ["ADMIN"],
      invalidRoleMessage: "In questa fase l'invito supporta solo il ruolo ADMIN",
    };
  }

  const ctx = getProductStandaloneContext(enabledModules);
  const allowed = standaloneOperatoreRoles(ctx);

  if (allowed.length === 1) {
    const r = allowed[0]!;
    return {
      defaultRole: r,
      allowedRoles: [r],
      invalidRoleMessage:
        r === "RECRUITER"
          ? "Su Credixa Recruiter l'invito supporta solo il ruolo RECRUITER"
          : "Su Credixa Legal AI l'invito supporta solo il ruolo AVVOCATO",
    };
  }

  if (allowed.length >= 2) {
    return {
      defaultRole: allowed[0]!,
      allowedRoles: allowed,
      invalidRoleMessage: `Invito add-on: ruoli ammessi ${allowed.join(", ")}`,
    };
  }

  if (isFormazioneProductTenant(enabledModules)) {
    return formazioneProductInvitePolicy();
  }

  if (isDialerProductTenant(enabledModules)) {
    return dialerProductInvitePolicy();
  }

  return {
    defaultRole: "ADMIN",
    allowedRoles: ["ADMIN"],
    invalidRoleMessage: "In questa fase l'invito supporta solo il ruolo ADMIN",
  };
}

export function inviteEmailRolePhrase(role: string): string {
  const r = String(role || "").trim().toUpperCase();
  if (r === "RECRUITER") return "reclutatore";
  if (r === "AVVOCATO") return "avvocato";
  return "amministratore";
}
