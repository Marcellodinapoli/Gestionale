import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isUserPasswordExpired } from "@/lib/passwordPolicy";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    if (await isUserPasswordExpired(user.id)) redirect("/cambia-password");
    redirect("/");
  }

  return (
    <div className="page-gutter flex min-h-screen items-center justify-center bg-[var(--navy)] py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Credixa
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Accedi</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Demo: codice azienda <strong>demo</strong> — password <strong>Demo123!</strong>
          <br />
          <span className="mt-1 block">
            <strong>admin</strong> = amministratore azienda ·{" "}
            <strong>amministrazione</strong> = ufficio amministrazione (non è l&apos;admin
            azienda) · supervisor / backoffice / operatore / manutenzione @gestionale.local
          </span>
          Seconda azienda: codice <strong>alfa</strong>.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
