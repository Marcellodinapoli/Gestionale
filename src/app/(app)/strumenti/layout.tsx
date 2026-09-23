import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireModule, requireNavPage } from "@/lib/guard";
import { isFormazioneOnly } from "@/lib/permissions";
import { homePathForUser } from "@/lib/formazioneOnlyAccess";
import {
  FormazioneProvider,
  FormazioneGate,
} from "@/components/formazione/FormazioneProvider";
import { StrumentiNav } from "@/components/strumenti/StrumentiNav";

export default async function StrumentiLayout({ children }: { children: ReactNode }) {
  await requireModule("strumenti");
  const user = await requireNavPage("strumenti");
  if (isFormazioneOnly(user)) redirect(homePathForUser(user));

  return (
    <FormazioneProvider>
      <div className="space-y-4">
        <StrumentiNav />
        <FormazioneGate>{children}</FormazioneGate>
      </div>
    </FormazioneProvider>
  );
}
