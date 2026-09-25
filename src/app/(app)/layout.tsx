import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isCurrentUserPasswordExpired } from "@/lib/auth";
import { mustChoosePostazioneAlLogin, richiedeInternoPerChiamata } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import { NavAccessGuard } from "@/components/NavAccessGuard";
import { SoftRefresh } from "@/components/SoftRefresh";
import { TelephonyDialProvider } from "@/components/telefonia/TelephonyDialProvider";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await isCurrentUserPasswordExpired()) {
    redirect("/cambia-password");
  }
  const { needsSediSetup } = await import("@/lib/sediSetup");
  const { getDialClientConfig } = await import("@/lib/telephony");
  const { getTenantPlatformConfig } = await import("@/lib/platform/tenantProfile");
  const { getEffectiveNavVisibilityForUser } = await import("@/lib/navVisibility");
  const [needsSedi, dialConfig, platform, navVisibility] = await Promise.all([
    needsSediSetup(user),
    getDialClientConfig(user.tenantId, user.tenantSlug),
    getTenantPlatformConfig(user.tenantId, user.tenantSlug),
    getEffectiveNavVisibilityForUser(user, user),
  ]);
  if (needsSedi) {
    redirect("/setup-sedi");
  }
  if (mustChoosePostazioneAlLogin(user)) {
    redirect("/seleziona-postazione");
  }
  return (
    <AppShell user={user} platform={platform} navVisibility={navVisibility}>
      <NavAccessGuard navVisibility={navVisibility} />
      <SoftRefresh intervalMs={180_000} />
      <TelephonyDialProvider
        config={dialConfig}
        prefissoChiamata={user.prefissoChiamata}
        interno={user.interno}
        richiedeInterno={richiedeInternoPerChiamata(user.role)}
      >
        {children}
      </TelephonyDialProvider>
    </AppShell>
  );
}
