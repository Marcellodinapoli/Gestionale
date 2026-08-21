import { prisma } from "@/lib/prisma";

export const SANZIONE_ATTIVA_PREFIX = "SANZIONE ATTIVA";

/**
 * Dopo un incasso massivo: avvisa chi lavora il mandato
 * (lock aperto o assegnatario/titolare delle pratiche toccate).
 */
export async function notificaSanzioneIncassoMassivo(input: {
  fromUserId: string;
  tenantId: string;
  praticaIds: string[];
}) {
  const ids = [...new Set(input.praticaIds.filter(Boolean))];
  if (!ids.length) return { notificati: 0 };

  const pratiche = await prisma.pratica.findMany({
    where: { id: { in: ids }, tenantId: input.tenantId },
    select: {
      id: true,
      mandanteId: true,
      assegnatarioId: true,
      operatoreTitolareId: true,
      mandante: { select: { codice: true, ragioneSociale: true } },
    },
  });
  if (!pratiche.length) return { notificati: 0 };

  const byMandante = new Map<
    string,
    {
      codice: string;
      ragioneSociale: string;
      destinatari: Set<string>;
      nIncassi: number;
    }
  >();

  for (const p of pratiche) {
    let row = byMandante.get(p.mandanteId);
    if (!row) {
      row = {
        codice: p.mandante.codice,
        ragioneSociale: p.mandante.ragioneSociale,
        destinatari: new Set(),
        nIncassi: 0,
      };
      byMandante.set(p.mandanteId, row);
    }
    row.nIncassi += 1;
    if (p.assegnatarioId) row.destinatari.add(p.assegnatarioId);
    if (p.operatoreTitolareId) row.destinatari.add(p.operatoreTitolareId);
  }

  const mandanteIds = [...byMandante.keys()];
  const locks = await prisma.praticaLock.findMany({
    where: {
      pratica: { tenantId: input.tenantId, mandanteId: { in: mandanteIds } },
    },
    select: {
      userId: true,
      pratica: { select: { mandanteId: true } },
    },
  });
  for (const lock of locks) {
    const row = byMandante.get(lock.pratica.mandanteId);
    if (row) row.destinatari.add(lock.userId);
  }

  let notificati = 0;
  for (const [, info] of byMandante) {
    const testo =
      `${SANZIONE_ATTIVA_PREFIX} sul mandato ${info.codice} (${info.ragioneSociale}). ` +
      `Registrato incasso massivo (${info.nIncassi} pratic${info.nIncassi === 1 ? "a" : "he"}).`;

    for (const toUserId of info.destinatari) {
      if (toUserId === input.fromUserId) continue;
      await prisma.messaggioInterno.create({
        data: {
          fromUserId: input.fromUserId,
          toUserId,
          praticaId: null,
          testo,
        },
      });
      notificati += 1;
    }
  }

  return { notificati };
}

export function isSanzioneAttivaTesto(testo: string) {
  return testo.trim().toUpperCase().startsWith(SANZIONE_ATTIVA_PREFIX);
}
