import { postazioniDb } from "@/lib/postazioniRepo";

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
        select: { id: true, name: true },
      },
    },
  });
  if (!postazione) {
    return { error: "Postazione non valida" as const };
  }
  if (postazione.occupanti.length > 0) {
    return {
      error: `Postazione già occupata da ${postazione.occupanti[0].name}` as const,
    };
  }
  return { postazione };
}
