import type { ReactNode } from "react";
import { LegalAiLayoutShell } from "@/components/legal-ai/LegalAiLayoutShell";
import { requireLegalAiPageAccess } from "@/lib/platform/guard";

export default async function LegalAiLayout({ children }: { children: ReactNode }) {
  const user = await requireLegalAiPageAccess();
  return (
    <LegalAiLayoutShell storageScope={{ tenantId: user.tenantId, userId: user.id }}>
      {children}
    </LegalAiLayoutShell>
  );
}
