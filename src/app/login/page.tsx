import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { mustChoosePostazioneAlLogin } from "@/lib/permissions";
import { homePathForUser } from "@/lib/formazioneOnlyAccess";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    const [{ isUserPasswordExpired }, { needsSediSetup }] = await Promise.all([
      import("@/lib/passwordPolicy"),
      import("@/lib/sediSetup"),
    ]);
    if (await isUserPasswordExpired(user.id)) redirect("/cambia-password");
    if (user.formazioneOnly) redirect(homePathForUser(user));
    if (await needsSediSetup(user)) redirect("/setup-sedi");
    if (mustChoosePostazioneAlLogin(user)) redirect("/seleziona-postazione");
    redirect("/");
  }

  return (
    <div className="page-gutter flex min-h-screen items-center justify-center bg-[var(--navy)] py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Credixa
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Accedi</h1>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
