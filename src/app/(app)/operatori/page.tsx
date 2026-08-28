import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { OperatoriGestione } from "@/components/operatori/OperatoriGestione";
import { NuovoOperatoreButton } from "@/components/operatori/NuovoOperatoreButton";

export default async function OperatoriPage() {
  const user = await requirePermission("operatori:manage");

  const [users, supervisori, sedi] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        acronimo: true,
        formazioneOnly: true,
        lastLoginAt: true,
        lastLogoutAt: true,
        sedeId: true,
        sede: { select: { nome: true } },
        postazione: { select: { nome: true, interno: true } },
        supervisor: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "SUPERVISOR", active: true, tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.sede.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const lista = users.map((u) => ({
    id: u.id,
    name: u.name,
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
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestione operatori"
        subtitle="Acronimi, accesso formazione/completo, reset password e creazione utenti"
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
          creatorRole={user.role}
        />
      </Card>
    </div>
  );
}
