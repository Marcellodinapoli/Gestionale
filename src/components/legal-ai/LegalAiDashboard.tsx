import Link from "next/link";
import { ArrowRight, FilePlus2 } from "lucide-react";

export function LegalAiDashboard() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Credixa Legal AI
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--navy)]">
          Assistente alla redazione di atti
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Avvia una nuova redazione e segui il flusso: tipologia di atto, raccolta informazioni,
          ricerca giuridica, revisione ed esportazione sul tuo computer. Nessun archivio fascicoli
          o documenti sui server Credixa.
        </p>
      </header>

      <section
        aria-labelledby="legal-ai-start-heading"
        className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-6 shadow-sm"
      >
        <h2 id="legal-ai-start-heading" className="text-lg font-semibold text-[var(--navy)]">
          Nuova redazione
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Inizia scegliendo la tipologia di atto; poi prosegui con i passaggi del menu interno.
        </p>
        <Link
          href="/legal-ai/nuovo-atto"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden />
          Avvia nuova redazione
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
