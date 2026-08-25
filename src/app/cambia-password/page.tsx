import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isUserPasswordExpired } from "@/lib/passwordPolicy";
import { requiresPostazione } from "@/lib/permissions";
import { homePathForUser } from "@/lib/formazioneOnlyAccess";
import { CambioPasswordForm } from "@/components/account/CambioPasswordForm";
import { logoutAction } from "@/actions/core";

export default async function CambiaPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const expired = await isUserPasswordExpired(user.id);
  if (!expired) redirect("/");

  const afterHref = user.formazioneOnly
    ? homePathForUser(user)
    : requiresPostazione(user)
      ? "/seleziona-postazione"
      : "/";

  return (
    <div className="page-gutter flex min-h-screen items-center justify-center bg-[var(--navy)] py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Sicurezza account
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Password scaduta</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ciao {user.name}, la password non è stata cambiata negli ultimi 30 giorni. Devi
          impostarne una nuova per accedere al gestionale: finché non la aggiorni non potrai
          entrare nell&apos;applicazione.
        </p>
        <div className="mt-6">
          <CambioPasswordForm forced onSuccessHref={afterHref} />
        </div>
        <form action={logoutAction} className="mt-4">
          <button
            type="submit"
            className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Esci
          </button>
        </form>
      </div>
    </div>
  );
}
