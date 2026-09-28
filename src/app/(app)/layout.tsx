import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isCurrentUserPasswordExpired } from "@/lib/auth";
import { mustChoosePostazioneAlLogin, richiedeInternoPerChiamata } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import { NavAccessGuard } from "@/components/NavAccessGuard";
import { SectionActivationGate } from "@/components/SectionActivationGate";
import { SoftRefresh } from "@/components/SoftRefresh";
import { PerfMonitor } from "@/components/performance/PerfMonitor";
import { TelephonyDialProvider } from "@/components/telefonia/TelephonyDialProvider";
import { isAwaitingSectionActivation } from "@/lib/platform/modules";

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
  const { isPerfMonitoringEnabled } = await import("@/lib/performance/enabled");
  const [needsSedi, dialConfig, platform, navVisibility, perfMonitoringEnabled] =
    await Promise.all([
      needsSediSetup(user),
      getDialClientConfig(user.tenantId, user.tenantSlug),
      getTenantPlatformConfig(user.tenantId, user.tenantSlug),
      getEffectiveNavVisibilityForUser(user, user),
      isPerfMonitoringEnabled(user.tenantId),
    ]);
  if (needsSedi) {
    redirect("/setup-sedi");
  }
  if (mustChoosePostazioneAlLogin(user)) {
    redirect("/seleziona-postazione");
  }
  const awaiting = isAwaitingSectionActivation(platform.enabledModules);
  return (
    <AppShell user={user} platform={platform} navVisibility={navVisibility}>
      <SectionActivationGate platform={platform} />
      {!awaiting ? <NavAccessGuard navVisibility={navVisibility} /> : null}
      <SoftRefresh intervalMs={180_000} />
      {perfMonitoringEnabled ? <PerfMonitor enabled /> : null}
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
