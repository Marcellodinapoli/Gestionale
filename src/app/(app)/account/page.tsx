import { usersDbFromUser } from "@/lib/usersRepo";
import { postazioniDbFromUser } from "@/lib/postazioniRepo";
import { requireUser } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { AccountEditor } from "@/components/account/AccountEditor";
import { giorniAllaScadenzaPassword } from "@/lib/passwordPolicy";
import {
  can,
  canImpostarePostazioneFissa,
  isFormazioneOnly,
  requiresPostazione,
  type Role,
} from "@/lib/permissions";

export default async function AccountPage() {
  const session = await requireUser();

  const user = await usersDbFromUser(session).findUnique({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      role: true,
      interno: true,
      prefissoChiamata: true,
      passwordChangedAt: true,
      postazioneId: true,
      postazioneFissa: true,
      postazione: { select: { nome: true, interno: true } },
    },
  });
  if (!user) return null;

  const gestiscePostazione = requiresPostazione({
    role: user.role as Role,
    formazioneOnly: session.formazioneOnly,
  });

  const postazioni = gestiscePostazione
    ? await postazioniDbFromUser(session).findMany({
        where: { active: true, tenantId: session.tenantId },
        orderBy: [{ sedeRef: { nome: "asc" } }, { nome: "asc" }],
        include: {
          sedeRef: { select: { nome: true } },
          occupanti: {
            where: { active: true, id: { not: session.id }, tenantId: session.tenantId },
            select: { id: true, name: true },
          },
        },
      })
    : [];

  const postazioniLista = postazioni.map((p) => ({
    id: p.id,
    nome: p.nome,
    interno: p.interno,
    sede: p.sedeRef?.nome || null,
    occupante: p.occupanti[0]?.name || null,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Account"
        subtitle="Il tuo profilo, le impostazioni telefoniche e la password"
      />
      <AccountEditor
        showFormazione={can(session, "formazione:view")}
        showStrumenti={can(session, "formazione:view") && !isFormazioneOnly(session)}
        user={{
          name: user.name,
          email: user.email,
          role: user.role as Role,
          interno: user.interno?.trim() || user.postazione?.interno || "",
          prefissoChiamata: user.prefissoChiamata || "",
          postazioneNome: user.postazione?.nome ?? null,
          postazioneInterno: user.postazione?.interno ?? null,
          postazioneId: user.postazioneId,
          postazioneFissa: Boolean(user.postazioneFissa),
          showPostazioneFissa: canImpostarePostazioneFissa(user.role as Role),
          gestiscePostazione,
          postazioni: postazioniLista,
          giorniAllaScadenza: giorniAllaScadenzaPassword(user.passwordChangedAt),
        }}
      />
    </div>
  );
}
