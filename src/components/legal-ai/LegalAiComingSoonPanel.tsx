import type { ReactNode } from "react";

type Props = {
  title?: string;
  children?: ReactNode;
};

/** Avviso uniforme: UI pronta, servizi non ancora collegati. */
export function LegalAiComingSoonPanel({
  title = "Interfaccia pronta",
  children,
}: Props) {
  return (
    <div
      className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-5 py-4 text-sm text-violet-950"
      role="status"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-violet-900/80">
        {children ??
          "I controlli sono navigabili; ricerca, redazione AI ed export saranno collegati nelle fasi successive. Nessun dato viene salvato sui server Credixa."}
      </p>
    </div>
  );
}
