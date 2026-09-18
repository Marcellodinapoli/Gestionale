import type { ReactNode } from "react";
import { LegalHubNav } from "@/components/giudiziale/LegalHubNav";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <LegalHubNav />
      {children}
    </div>
  );
}
