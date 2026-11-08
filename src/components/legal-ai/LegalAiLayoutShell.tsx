"use client";

import type { ReactNode } from "react";
import { LegalAiHubNav } from "@/components/legal-ai/LegalAiHubNav";
import { LegalAiSessionBanner } from "@/components/legal-ai/LegalAiSessionBanner";
import { LegalAiSessionProvider } from "@/components/legal-ai/LegalAiSessionProvider";
import type { LegalAiStorageScope } from "@/lib/legal-ai/sessionTypes";

export function LegalAiLayoutShell({
  storageScope,
  children,
}: {
  storageScope: LegalAiStorageScope;
  children: ReactNode;
}) {
  return (
    <LegalAiSessionProvider storageScope={storageScope}>
      <div className="space-y-6">
        <LegalAiHubNav />
        <LegalAiSessionBanner />
        {children}
      </div>
    </LegalAiSessionProvider>
  );
}
