import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isUserPasswordExpired } from "@/lib/passwordPolicy";
import { requiresPostazione } from "@/lib/permissions";
import { getDialClientConfig } from "@/lib/telephony";
import { AppShell } from "@/components/AppShell";
import { TelephonyDialProvider } from "@/components/telefonia/TelephonyDialProvider";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await isUserPasswordExpired(user.id)) {
    redirect("/cambia-password");
  }
  if (requiresPostazione(user) && !user.postazioneId) {
    redirect("/seleziona-postazione");
  }
  const dialConfig = await getDialClientConfig(user.tenantId);
  return (
    <AppShell user={user}>
      <TelephonyDialProvider
        config={dialConfig}
        prefissoChiamata={user.prefissoChiamata}
      >
        {children}
      </TelephonyDialProvider>
    </AppShell>
  );
}
