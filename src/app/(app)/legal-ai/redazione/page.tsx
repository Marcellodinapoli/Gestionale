import { LegalAiSectionShell } from "@/components/legal-ai/LegalAiSectionShell";
import { LegalAiRedazionePanel } from "@/components/legal-ai/LegalAiRedazionePanel";

export default function LegalAiRedazionePage() {
  return (
    <LegalAiSectionShell stepId="redazione" showComingSoon={false}>
      <LegalAiRedazionePanel />
    </LegalAiSectionShell>
  );
}
