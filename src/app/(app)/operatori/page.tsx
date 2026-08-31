import { usersDbFromUser } from "@/lib/usersRepo";
import { sediDbFromUser } from "@/lib/sediRepo";
import { requirePermission } from "@/lib/guard";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { condizioneEconomicaLabel, parseCondizioneEconomica } from "@/lib/condizioneEconomica";
import { Card, PageHeader } from "@/components/ui";
import { OperatoriGestione } from "@/components/operatori/OperatoriGestione";
import { NuovoOperatoreButton } from "@/components/operatori/NuovoOperatoreButton";

export default async function OperatoriPage() {
  const user = await requirePermission("operatori:manage");

  const userModel = usersDbFromUser(user);
  const [users, supervisori, sedi] = await Promise.all([
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
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestione operatori"
        subtitle="Anagrafica, condizione economica, accesso, sede e password"
        action={
          <NuovoOperatoreButton
            creatorRole={user.role}
            sedi={sedi}
            supervisori={supervisori}
          />
        }
      />

      <Card>
        <OperatoriGestione
          utenti={lista}
          sedi={sedi}
          supervisori={supervisori}
          creatorRole={user.role}
        />
      </Card>
    </div>
  );
}
