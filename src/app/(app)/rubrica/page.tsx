import { usersDbFromUser } from "@/lib/usersRepo";
import { requireNavPage } from "@/lib/guard";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { isUserSessionActive } from "@/lib/sessionPresence";
import { PageHeader } from "@/components/ui";
import { RubricaGriglia } from "@/components/rubrica/RubricaGriglia";

export default async function RubricaPage() {
  const user = await requireNavPage("rubrica");

  const utenti = await usersDbFromUser(user).findMany({
    where: {
      active: true,
      tenantId: user.tenantId,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      cognome: true,
      role: true,
      acronimo: true,
      email: true,
      interno: true,
      postazioneFissa: true,
      lastLoginAt: true,
      lastLogoutAt: true,
      postazione: {
        select: {
          nome: true,
          interno: true,
          email: true,
          numeroFisso: true,
          sedeRef: { select: { nome: true } },
        },
      },
    },
  });

  const showSelfBadge = true;

  const lista = utenti.map((u) => {
    const online = isUserSessionActive(u);
    const postazione = u.postazione
      ? {
          nome: u.postazione.nome,
          interno: u.postazione.interno || u.interno || null,
          email: u.postazione.email || null,
          numeroFisso: u.postazione.numeroFisso,
          sede: u.postazione.sedeRef?.nome || null,
        }
      : null;
    return {
      id: u.id,
      name: [u.name, u.cognome].filter(Boolean).join(" ").trim() || u.name,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role as Role] || u.role,
      acronimo: u.acronimo,
      email: u.email || null,
      online,
      postazione,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rubrica interna"
        subtitle="Postazioni e contatti aggiornati in tempo reale"
      />

      <RubricaGriglia
        utenti={lista}
        currentUserId={showSelfBadge ? user.id : undefined}
      />
    </div>
  );
}
