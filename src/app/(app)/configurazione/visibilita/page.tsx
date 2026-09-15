import { requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { NavVisibilityRoleMatrix } from "@/components/configurazione/NavVisibilityRoleMatrix";
import { loadNavRoleDefaults } from "@/lib/navVisibility/store";
import { NAV_VISIBILITY_ROLES } from "@/lib/navVisibility/catalog";
import type { Role } from "@/lib/permissions";
import Link from "next/link";

export default async function VisibilitaPaginePage({
  searchParams,
}: {
  searchParams?: Promise<{ ruolo?: string }> | { ruolo?: string };
}) {
  const user = await requireNavPage("configurazione");
  const defaults = await loadNavRoleDefaults(user);
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;
  const ruoloRaw = String(sp?.ruolo || "").trim() as Role;
  const initialRole = NAV_VISIBILITY_ROLES.includes(ruoloRaw)
    ? ruoloRaw
    : ("OPERATOR" as Role);

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Visibilità pagine"
        subtitle="Scegli quali pagine vede di default ogni tipo di account (es. Operatore). Vale per tutti gli utenti con quel ruolo."
      />
      <p className="text-sm text-[var(--muted)]">
        <Link href="/operatori" className="underline hover:text-[var(--navy)]">
          ← Operatori
        </Link>
      </p>
      <NavVisibilityRoleMatrix
        initialDefaults={defaults}
        initialRole={initialRole}
      />
    </div>
  );
}
