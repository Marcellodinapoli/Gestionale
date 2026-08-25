import type { ReactNode } from "react";
import { requirePermission } from "@/lib/guard";
import {
  FormazioneProvider,
  FormazioneGate,
} from "@/components/formazione/FormazioneProvider";
import { StrumentiNav } from "@/components/strumenti/StrumentiNav";

export default async function StrumentiLayout({ children }: { children: ReactNode }) {
  await requirePermission("formazione:view");

  return (
    <FormazioneProvider>
      <div className="mx-auto w-full max-w-[1300px] px-4 sm:px-6">
        <StrumentiNav />
        <div className="mt-4">
          <FormazioneGate>{children}</FormazioneGate>
        </div>
      </div>
    </FormazioneProvider>
  );
}
