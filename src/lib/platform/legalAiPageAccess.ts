import { hasModule, isAwaitingSectionActivation, type TenantPlatformConfig } from "@/lib/platform/modules";

export type LegalAiPageDenyReason = "module" | "nav";

export type LegalAiPageGuardOutcome =
  | { status: "allow" }
  | {
      status: "redirect";
      target: "/attivazione-sezioni" | "/account" | "nav-hidden";
    };

/**
 * Decisione accesso area `/legal-ai` (layout: requireModule + requireNavPage).
 * `legalAiNavVisible` = risultato visibilità effettiva pagina `legalAi` per l’utente.
 */
export function evaluateLegalAiPageAccess(input: {
  platform: TenantPlatformConfig;
  legalAiNavVisible: boolean;
}): { allowed: true } | { allowed: false; reason: LegalAiPageDenyReason } {
  if (!hasModule(input.platform.enabledModules, "legal-ai")) {
    return { allowed: false, reason: "module" };
  }
  if (!input.legalAiNavVisible) {
    return { allowed: false, reason: "nav" };
  }
  return { allowed: true };
}

/**
 * Esito guard Legal AI testabile (redirect applicati in requireLegalAiPageAccess).
 * Ordine: attivazione sezioni → modulo → visibilità.
 */
export function resolveLegalAiPageGuardOutcome(input: {
  platform: TenantPlatformConfig;
  legalAiNavVisible: boolean;
}): LegalAiPageGuardOutcome {
  if (isAwaitingSectionActivation(input.platform.enabledModules)) {
    return { status: "redirect", target: "/attivazione-sezioni" };
  }
  const decision = evaluateLegalAiPageAccess(input);
  if (decision.allowed) {
    return { status: "allow" };
  }
  if (decision.reason === "module") {
    return { status: "redirect", target: "/account" };
  }
  return { status: "redirect", target: "nav-hidden" };
}
