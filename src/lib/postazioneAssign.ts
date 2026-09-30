import { postazioniDb } from "@/lib/postazioniRepo";
import { usersDb } from "@/lib/usersRepo";
import {
  formatUtenteNome,
  isUserSessionActive,
  occupantBlocksDesk,
} from "@/lib/sessionPresence";

export async function validaPostazionePerUtente(
  postazioneId: string,
  userId: string,
  tenantId: string,
  tenantSlug?: string | null
) {
  const ctx = { tenantId, tenantSlug: tenantSlug ?? tenantId };
  const postazione = await postazioniDb(ctx).findFirst({
    where: { id: postazioneId, tenantId, active: true },
    include: {
      occupanti: {
        where: { active: true, id: { not: userId }, tenantId },
        select: {
          id: true,
          name: true,
          cognome: true,
          role: true,
          postazioneFissa: true,
          lastLoginAt: true,
          lastLogoutAt: true,
        },
      },
    },
  });
  if (!postazione) {
    return { error: "Postazione non valida" as const };
  }
  // Solo fissa o sessione ancora aperta: evita "occupata" da logout non rilasciato.
  const occupantiAttivi = (postazione.occupanti ?? []).filter(occupantBlocksDesk);
  if (occupantiAttivi.length > 0) {
    return {
      error: `Postazione già occupata da ${formatUtenteNome(occupantiAttivi[0])}` as const,
    };
  }
  return { postazione };
}

/**
 * Rimuove dalla postazione gli altri utenti senza sessione attiva e senza fissa
 * (residui da chiusura browser senza logout).
 */
export async function liberaPostazioneDaResidui(
  postazioneId: string,
  keepUserId: string,
  tenantId: string,
  tenantSlug?: string | null
) {
  const ctx = { tenantId, tenantSlug: tenantSlug ?? tenantId };
  const altri = await usersDb(ctx).findMany({
    where: {
      tenantId,
      active: true,
      postazioneId,
      id: { not: keepUserId },
    },
    select: {
      id: true,
      postazioneFissa: true,
      lastLoginAt: true,
      lastLogoutAt: true,
    },
  });
  const daLiberare = altri.filter(
    (o) => !o.postazioneFissa && !isUserSessionActive(o)
  );
  if (daLiberare.length === 0) return;
  await usersDb(ctx).updateMany({
    where: { id: { in: daLiberare.map((o) => o.id) }, tenantId },
    data: { postazioneId: null, lastLogoutAt: new Date() },
  });
}
