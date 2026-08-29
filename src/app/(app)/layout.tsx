import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isCurrentUserPasswordExpired } from "@/lib/auth";
import { mustChoosePostazioneAlLogin, richiedeInternoPerChiamata } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import { NavPrefetch } from "@/components/NavPrefetch";
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
  if (await needsSediSetup(user)) {
    redirect("/setup-sedi");
  }
  if (mustChoosePostazioneAlLogin(user)) {
    redirect("/seleziona-postazione");
  }
  const { getDialClientConfig } = await import("@/lib/telephony");
  const dialConfig = await getDialClientConfig(user.tenantId);
  return (
    <AppShell user={user}>
      <NavPrefetch />
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
