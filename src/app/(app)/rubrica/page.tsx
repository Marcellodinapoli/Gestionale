import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { RubricaGriglia } from "@/components/rubrica/RubricaGriglia";

export default async function RubricaPage() {
  const user = await requireUser();

  const utenti = await prisma.user.findMany({
    where: {
      active: true,
      tenantId: user.tenantId,
      role: { in: ["OPERATOR", "SUPERVISOR", "BACK_OFFICE"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      acronimo: true,
      postazione: {
        select: {
          nome: true,
          interno: true,
          email: true,
          numeroFisso: true,
          sede: true,
        },
      },
    },
  });

  const lista = utenti.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role as Role] || u.role,
    acronimo: u.acronimo,
    online: !!u.postazione,
    postazione: u.postazione,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rubrica interna"
        subtitle="Postazioni e contatti aggiornati in tempo reale"
      />

      <RubricaGriglia utenti={lista} />
    </div>
  );
}
