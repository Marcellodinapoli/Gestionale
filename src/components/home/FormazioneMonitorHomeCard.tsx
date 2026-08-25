import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";

export function FormazioneMonitorHomeCard() {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-[#FB8C00]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--navy)]">Monitoraggio formazione</h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              Controlla i progressi CreditForm del team: corsi, warm-up e roleplay per ogni
              operatore.
            </p>
          </div>
        </div>
        <Link
          href="/formazione/collaboratori"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] bg-[#FAFAFA] px-3 py-2 text-sm font-medium text-[var(--navy)] hover:bg-white"
        >
          Apri collaboratori
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
