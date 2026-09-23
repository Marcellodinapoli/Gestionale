import type { ReactNode } from "react";
import { requireModule, requireNavPage } from "@/lib/guard";
import { LegalHubNav } from "@/components/giudiziale/LegalHubNav";

export default async function LegalLayout({ children }: { children: ReactNode }) {
  await requireModule("legale");
  await requireNavPage("legal");
  return (
    <div className="space-y-4">
      <LegalHubNav />
      {children}
    </div>
  );
}
