import { logoutAction } from "@/actions/core";

export default function AttivazioneSezioniPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-[var(--fg)]">
        In attesa di attivazione
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        Nessuna sezione del gestionale è ancora attiva per questa azienda.
        Contatta Credixa o il tuo referente commerciale per richiedere
        l&apos;attivazione delle sezioni necessarie.
      </p>
      <form action={logoutAction} className="mt-8">
        <button
          type="submit"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-2)]"
        >
          Esci
        </button>
      </form>
    </div>
  );
}
