import { postazioniDb } from "@/lib/postazioniRepo";
import { occupantBlocksDesk } from "@/lib/sessionPresence";

export async function validaPostazionePerUtente(
  postazioneId: string,
  userId: string,
  tenantId: string,
  tenantSlug?: string | null
) {
  const postazione = await postazioniDb({
    tenantId,
    tenantSlug: tenantSlug ?? tenantId,
  }).findFirst({
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
