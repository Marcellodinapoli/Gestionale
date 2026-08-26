import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isUserPasswordExpired } from "@/lib/passwordPolicy";
import { canManageSedi } from "@/lib/permissions";
import { needsSediSetup } from "@/lib/sediSetup";
import { SetupSediWizard } from "@/components/sedi/SetupSediWizard";
import { logoutAction } from "@/actions/core";

export default async function SetupSediPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await isUserPasswordExpired(user.id)) redirect("/cambia-password");
  if (!canManageSedi(user)) redirect("/");
  if (!(await needsSediSetup(user))) redirect("/sedi");

  return (
    <div className="page-gutter flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 py-6">
      <div className="w-full max-w-3xl space-y-4">
        <SetupSediWizard tenantNome={user.tenantNome || "l'azienda"} />
        <form action={logoutAction} className="text-center">
          <button
            type="submit"
            className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Esci e torna al login
          </button>
        </form>
      </div>
    </div>
  );
}
