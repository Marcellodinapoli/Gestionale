import type { ReactNode } from "react";
import { legalAiSectionById, type LegalAiWorkflowStepId } from "@/lib/legal-ai/sections";
import { LegalAiComingSoonPanel } from "@/components/legal-ai/LegalAiComingSoonPanel";

type Props = {
  stepId: LegalAiWorkflowStepId;
  children?: ReactNode;
  /** Se false, nasconde il pannello «Interfaccia pronta» (es. pagina con sola UI). */
  showComingSoon?: boolean;
};

export function LegalAiSectionShell({
  stepId,
  children,
  showComingSoon = false,
}: Props) {
  const section = legalAiSectionById(stepId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Credixa Legal AI
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--navy)]">
          {section.label}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{section.summary}</p>
      </header>

      {showComingSoon ? <LegalAiComingSoonPanel /> : null}

      {children}
    </div>
  );
}
