import { usersDbFromUser } from "@/lib/usersRepo";
import { sediDbFromUser } from "@/lib/sediRepo";
import { requireNavPage } from "@/lib/guard";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { condizioneEconomicaLabel, parseCondizioneEconomica } from "@/lib/condizioneEconomica";
import { OperatoriWorkspace } from "@/components/operatori/OperatoriWorkspace";
import { NuovoOperatoreButton } from "@/components/operatori/NuovoOperatoreButton";
import { loadNavRoleDefaults, loadNavUserOverridesAll } from "@/lib/navVisibility/store";
import { loadOperatoriProfiliAll } from "@/lib/operatoriProfilo";
import Link from "next/link";

export default async function OperatoriPage() {
  const user = await requireNavPage("operatori");

  const userModel = usersDbFromUser(user);
  const [users, supervisori, sedi, roleDefaults, userOverrides, profili] = await Promise.all([
    userModel.findMany({
      where: { active: true, tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        cognome: true,
        email: true,
        role: true,
        acronimo: true,
        formazioneOnly: true,
        consulenteEsterno: true,
        creditCalcEnabled: true,
        lastLoginAt: true,
        lastLogoutAt: true,
        condizioneEconomica: true,
        importoFisso: true,
        supervisorId: true,
        codiceFiscale: true,
        residenza: true,
        sedeId: true,
        sede: { select: { nome: true } },
        postazione: { select: { nome: true, interno: true } },
        supervisor: { select: { name: true } },
      },
    }),
    userModel.findMany({
      where: { role: "SUPERVISOR", active: true, tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    sediDbFromUser(user).findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    loadNavRoleDefaults(user),
    loadNavUserOverridesAll(user),
    loadOperatoriProfiliAll(user),
  ]);

  const lista = users.map((u) => ({
    id: u.id,
    name: u.name,
    cognome: u.cognome,
    email: u.email,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role as Role] || u.role,
    acronimo: u.acronimo,
    formazioneOnly: u.formazioneOnly,
    consulenteEsterno: Boolean(u.consulenteEsterno),
    creditCalcEnabled: Boolean(u.creditCalcEnabled),
    lastLoginAt: u.lastLoginAt?.toISOString() || null,
    lastLogoutAt: u.lastLogoutAt?.toISOString() || null,
    postazione: u.postazione?.nome || null,
    interno: u.postazione?.interno || null,
    supervisorName: u.supervisor?.name || null,
    sedeId: u.sedeId,
    sedeNome: u.sede?.nome || null,
    condizioneEconomica: condizioneEconomicaLabel(u.condizioneEconomica),
    condizioneEconomicaValue: parseCondizioneEconomica(u.condizioneEconomica),
    importoFisso: u.importoFisso != null ? Number(u.importoFisso) : null,
    supervisorId: u.supervisorId,
    codiceFiscale: u.codiceFiscale,
    residenza: u.residenza,
    qualificheScolastiche: profili[u.id]?.qualificheScolastiche || null,
  }));

  const acronimiUsati = lista
    .map((u) => u.acronimo)
    .filter((a): a is string => Boolean(a?.trim()));

  return (
    <OperatoriWorkspace
      utenti={lista}
      sedi={sedi}
      supervisori={supervisori}
      creatorRole={user.role}
      roleDefaults={roleDefaults}
      userOverrides={userOverrides}
      acronimiUsati={acronimiUsati}
      headerActions={
        <>
          <Link
            href="/configurazione/visibilita"
            className="inline-flex h-9 items-center rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--navy)] hover:bg-slate-50"
          >
            Default pagine per ruolo
          </Link>
          <NuovoOperatoreButton
            creatorRole={user.role}
            sedi={sedi}
            supervisori={supervisori}
            roleDefaults={roleDefaults}
            acronimiUsati={acronimiUsati}
          />
        </>
      }
    />
  );
}
