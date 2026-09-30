import { redirect } from "next/navigation";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { mustChoosePostazioneAlLogin } from "@/lib/permissions";
import { hasPostazioneSkip } from "@/lib/postazioneGate";
import { homePathForUser } from "@/lib/formazioneOnlyAccess";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const fromInvite = sp.from === "invite";
  const tenantSlug = (sp.tenant || "").trim();
  const email = (sp.email || "").trim();

  if (fromInvite) {
    // Dopo attiva-account: forza logout e mostra form con credenziali nuova azienda.
    await clearSession();
  } else {
    const user = await getCurrentUser();
    if (user) {
      const [{ isUserPasswordExpired }, { needsSediSetup }] = await Promise.all([
        import("@/lib/passwordPolicy"),
        import("@/lib/sediSetup"),
      ]);
      if (await isUserPasswordExpired(user.id)) redirect("/cambia-password");
      if (user.formazioneOnly) redirect(homePathForUser(user));
      if (await needsSediSetup(user)) redirect("/setup-sedi");
      if (mustChoosePostazioneAlLogin(user) && !(await hasPostazioneSkip())) redirect("/seleziona-postazione");
      redirect("/");
    }
  }

  const fromInviteUi = fromInvite || Boolean(tenantSlug);

  return (
    <div className="page-gutter flex min-h-screen items-center justify-center bg-[var(--navy)] py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Credixa
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Accedi</h1>
        {fromInviteUi ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Account attivato. Accedi con il codice azienda e la password appena impostata.
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Demo: codice <strong>demo</strong> · admin@gestionale.local · password{" "}
            <strong>Demo123!</strong>
          </p>
        )}
        <div className="mt-6">
          <LoginForm
            defaultTenantSlug={tenantSlug || (fromInviteUi ? "" : "demo")}
            defaultEmail={email || (fromInviteUi ? "" : "admin@gestionale.local")}
            defaultPassword={fromInviteUi ? "" : "Demo123!"}
          />
        </div>
      </div>
    </div>
  );
}
