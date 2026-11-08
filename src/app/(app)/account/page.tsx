import { usersDbFromUser } from "@/lib/usersRepo";
import { postazioniDbFromUser } from "@/lib/postazioniRepo";
import { requireUser } from "@/lib/guard";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AccountEditor } from "@/components/account/AccountEditor";
import { giorniAllaScadenzaPassword } from "@/lib/passwordPolicy";
import { getTenantPlatformConfig, tenantHasModule } from "@/lib/platform/tenantProfile";
import {
  canImpostarePostazioneFissa,
  canCambiarePostazioneDaAccount,
  requiresPostazione,
  type Role,
} from "@/lib/permissions";
import { blockingOccupants, formatUtenteNome } from "@/lib/sessionPresence";
import { postazioneSchedaFromRow, type PostazioneSchedaView } from "@/lib/postazioniSchedaFields";

function idEquals(a: string | null | undefined, b: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export default async function AccountPage() {
  const session = await requireUser();
  const platform = await getTenantPlatformConfig(session.tenantId, session.tenantSlug);

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
      consulenteEsterno: true,
      creditCalcEnabled: true,
      postazione: { select: { nome: true, interno: true } },
    },
  });
  if (!user) notFound();

  const gestiscePostazione = requiresPostazione({
    role: user.role as Role,
    formazioneOnly: session.formazioneOnly,
  });
  const canModificaPostazioneDaAccount =
    gestiscePostazione && canCambiarePostazioneDaAccount(user.role as Role);

  // Sempre carichiamo le postazioni attive: servono anche all'admin per allineare
  // la card "Postazione" all'interno (es. int. 260 ↔ postazione 260).
  const postazioni = await postazioniDbFromUser(session).findMany({
    where: { active: true, tenantId: session.tenantId },
    orderBy: [{ sedeRef: { nome: "asc" } }, { nome: "asc" }],
    include: {
      sedeRef: { select: { nome: true } },
      occupanti: {
        where: { active: true, id: { not: session.id }, tenantId: session.tenantId },
        select: { id: true, name: true },
      },
    },
  });

  const postazioniLista = postazioni.map((p) => ({
    id: p.id,
    nome: p.nome,
    interno: p.interno,
    email: p.email,
    numeroFisso: p.numeroFisso,
    numeroFax: p.numeroFax,
    numeroWhatsapp: p.numeroWhatsapp,
    note: p.note,
    sede: p.sedeRef?.nome || null,
    occupante: (() => {
      const altri = blockingOccupants(p.occupanti).filter((o) => o.id !== session.id);
      return altri[0] ? formatUtenteNome(altri[0]) : null;
    })(),
  }));

  const internoEffettivo = user.interno?.trim() || "";
  const postazioneIdEff = user.postazioneId ?? session.postazioneId ?? null;

  let postazioneMatch = postazioneIdEff
    ? postazioniLista.find((p) => idEquals(postazioneIdEff, p.id))
    : undefined;
  if (!postazioneMatch && internoEffettivo) {
    postazioneMatch = postazioniLista.find(
      (p) =>
        (p.interno && p.interno.trim() === internoEffettivo) ||
        p.nome.trim() === internoEffettivo
    );
  }
  if (!postazioneMatch && session.postazioneNome?.trim()) {
    const nome = session.postazioneNome.trim();
    postazioneMatch = postazioniLista.find((p) => p.nome.trim() === nome);
  }
  if (!postazioneMatch && postazioneIdEff) {
    const row = await postazioniDbFromUser(session).findFirst({
      where: { id: postazioneIdEff, tenantId: session.tenantId },
      include: {
        sedeRef: { select: { nome: true } },
      },
    });
    if (row) {
      postazioneMatch = {
        id: row.id,
        nome: row.nome,
        interno: row.interno,
        email: row.email,
        numeroFisso: row.numeroFisso,
        numeroFax: row.numeroFax,
        numeroWhatsapp: row.numeroWhatsapp,
        note: row.note,
        sede: row.sedeRef?.nome || null,
        occupante: null,
      };
    }
  }

  const postazioneNome =
    user.postazione?.nome ?? session.postazioneNome ?? postazioneMatch?.nome ?? null;
  const postazioneInterno =
    user.postazione?.interno ?? postazioneMatch?.interno ?? (internoEffettivo || null);

  let postazioneDettaglio: PostazioneSchedaView | null =
    postazioneMatch != null ? postazioneSchedaFromRow(postazioneMatch) : null;

  if (!postazioneDettaglio && gestiscePostazione) {
    const nome = postazioneNome?.trim() || internoEffettivo || null;
    if (nome || session.postazioneEmail || session.sedeNome || session.postazioneNome) {
      postazioneDettaglio = postazioneSchedaFromRow({
        nome: nome || "—",
        sede: session.sedeNome ?? postazioneMatch?.sede ?? null,
        interno: postazioneInterno,
        email: session.postazioneEmail ?? postazioneMatch?.email ?? null,
        numeroFisso: postazioneMatch?.numeroFisso ?? null,
        numeroFax: postazioneMatch?.numeroFax ?? null,
        numeroWhatsapp: postazioneMatch?.numeroWhatsapp ?? null,
        note: postazioneMatch?.note ?? null,
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Account"
        subtitle="Il tuo profilo, le impostazioni telefoniche e la password"
      />
      <AccountEditor
        user={{
          name: user.name,
          email: user.email,
          role: user.role as Role,
          interno: internoEffettivo || postazioneInterno || "",
          prefissoChiamata: user.prefissoChiamata || "",
          postazioneNome,
          postazioneInterno,
          postazioneDettaglio,
          postazioneId: user.postazioneId ?? postazioneMatch?.id ?? null,
          postazioneFissa: Boolean(user.postazioneFissa),
          showPostazioneFissa: canImpostarePostazioneFissa(user.role as Role),
          gestiscePostazione,
          canModificaPostazioneDaAccount,
          postazioni: canModificaPostazioneDaAccount ? postazioniLista : undefined,
          giorniAllaScadenza: giorniAllaScadenzaPassword(user.passwordChangedAt),
          creditCalcEnabled: Boolean(
            user.consulenteEsterno &&
              user.creditCalcEnabled &&
              tenantHasModule(platform, "creditcalc")
          ),
        }}
      />
    </div>
  );
}
