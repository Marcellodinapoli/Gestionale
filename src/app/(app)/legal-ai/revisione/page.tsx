import { LegalAiSectionShell } from "@/components/legal-ai/LegalAiSectionShell";
import { LegalAiRevisionePanel } from "@/components/legal-ai/LegalAiRevisionePanel";

export default function LegalAiRevisionePage() {
  return (
    <LegalAiSectionShell stepId="revisione" showComingSoon={false}>
      <LegalAiRevisionePanel />
    </LegalAiSectionShell>
  );
}
