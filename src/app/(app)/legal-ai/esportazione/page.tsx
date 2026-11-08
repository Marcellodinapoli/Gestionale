import { LegalAiSectionShell } from "@/components/legal-ai/LegalAiSectionShell";
import { LegalAiEsportazionePanel } from "@/components/legal-ai/LegalAiEsportazionePanel";

export default function LegalAiEsportazionePage() {
  return (
    <LegalAiSectionShell stepId="esportazione" showComingSoon={false}>
      <LegalAiEsportazionePanel />
    </LegalAiSectionShell>
  );
}
