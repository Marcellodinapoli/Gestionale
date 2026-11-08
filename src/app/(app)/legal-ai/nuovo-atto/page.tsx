import { LegalAiSectionShell } from "@/components/legal-ai/LegalAiSectionShell";
import { LegalAiActTypePicker } from "@/components/legal-ai/LegalAiActTypePicker";

export default function LegalAiNuovoAttoPage() {
  return (
    <LegalAiSectionShell stepId="nuovoAtto" showComingSoon={false}>
      <LegalAiActTypePicker />
    </LegalAiSectionShell>
  );
}
