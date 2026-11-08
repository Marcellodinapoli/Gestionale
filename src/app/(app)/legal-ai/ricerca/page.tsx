import { LegalAiSectionShell } from "@/components/legal-ai/LegalAiSectionShell";
import { LegalAiRicercaPanel } from "@/components/legal-ai/LegalAiRicercaPanel";

export default function LegalAiRicercaPage() {
  return (
    <LegalAiSectionShell stepId="ricerca" showComingSoon={false}>
      <LegalAiRicercaPanel />
    </LegalAiSectionShell>
  );
}
