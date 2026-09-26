import { AttivaAccountForm } from "@/components/attiva-account/AttivaAccountForm";

export default async function AttivaAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token || "").trim();

  return (
    <div className="page-gutter flex min-h-screen items-center justify-center bg-[var(--navy)] py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Credixa
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Attiva account</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Imposta la password per il tuo account amministratore.
        </p>
        <div className="mt-6">
          <AttivaAccountForm token={token} />
        </div>
      </div>
    </div>
  );
}
