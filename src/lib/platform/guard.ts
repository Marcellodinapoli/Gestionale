import { redirect } from "next/navigation";
import {
  redirectAwayFromHiddenPage,
  requireUser,
} from "@/lib/guard";
import { getTenantPlatformConfig } from "@/lib/platform/tenantProfile";
import { resolveLegalAiPageGuardOutcome } from "@/lib/platform/legalAiPageAccess";

/**
 * Accesso area Credixa Legal AI (`/legal-ai`).
 * Ordine: auth → attivazione sezioni → modulo → visibilità pagina (redirect invariati).
 */
export async function requireLegalAiPageAccess() {
  const user = await requireUser();
  const platform = await getTenantPlatformConfig(user.tenantId, user.tenantSlug);
  const { getEffectiveNavVisibilityForUser } = await import("@/lib/navVisibility");
  const visible = await getEffectiveNavVisibilityForUser(user, user);
  const outcome = resolveLegalAiPageGuardOutcome({
    platform,
    legalAiNavVisible: visible.legalAi,
  });
  if (outcome.status === "allow") {
    return user;
  }
  if (outcome.target === "/attivazione-sezioni") {
    redirect("/attivazione-sezioni");
  }
  if (outcome.target === "/account") {
    if (user.formazioneOnly) redirect("/account");
    redirect("/account");
  }
  await redirectAwayFromHiddenPage(user, "legalAi");
  return user;
}
