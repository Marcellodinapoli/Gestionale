import type { ReactNode } from "react";
import { requirePermission } from "@/lib/guard";
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
  const user = await requirePermission("formazione:view");
  const canMonitor = user.role === "SUPERVISOR" || user.role === "ADMIN";

  return (
    <FormazioneProvider>
      <FormazioneIntroHost canMonitor={canMonitor}>
        <div className="mx-auto w-full max-w-[1300px] px-4 sm:px-6">
          <FormazioneNav canMonitor={canMonitor} />
          <div className="mt-4">
            <FormazioneGate>{children}</FormazioneGate>
          </div>
        </div>
      </FormazioneIntroHost>
    </FormazioneProvider>
  );
}
