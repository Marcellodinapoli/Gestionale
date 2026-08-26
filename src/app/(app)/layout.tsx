import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isCurrentUserPasswordExpired } from "@/lib/auth";
import { requiresPostazione } from "@/lib/permissions";
import { needsSediSetup } from "@/lib/sediSetup";
import { getDialClientConfig } from "@/lib/telephony";
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
  if (await needsSediSetup(user)) {
    redirect("/setup-sedi");
  }
  if (requiresPostazione(user) && !user.postazioneId) {
    redirect("/seleziona-postazione");
  }
  const dialConfig = await getDialClientConfig(user.tenantId);
  return (
    <AppShell user={user}>
      <NavPrefetch />
      <SoftRefresh intervalMs={180_000} />
      <TelephonyDialProvider
        config={dialConfig}
        prefissoChiamata={user.prefissoChiamata}
      >
        {children}
      </TelephonyDialProvider>
    </AppShell>
  );
}
