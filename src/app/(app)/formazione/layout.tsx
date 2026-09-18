import type { ReactNode } from "react";
import { requireNavPage } from "@/lib/guard";
import {
  FormazioneProvider,
  FormazioneGate,
} from "@/components/formazione/FormazioneProvider";
import { FormazioneIntroHost } from "@/components/formazione/FormazioneIntro";
import { FormazioneNav } from "@/components/formazione/FormazioneNav";

export default async function FormazioneLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireNavPage("formazione");
  const canMonitor = user.role === "SUPERVISOR" || user.role === "ADMIN";

  return (
    <FormazioneProvider>
      <FormazioneIntroHost canMonitor={canMonitor}>
        <div className="space-y-4">
          <FormazioneNav canMonitor={canMonitor} />
          <FormazioneGate>{children}</FormazioneGate>
        </div>
      </FormazioneIntroHost>
    </FormazioneProvider>
  );
}
