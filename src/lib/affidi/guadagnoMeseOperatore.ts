import "server-only";
import type { Prisma } from "@prisma/client";
import { provvigioniDbFromUser } from "@/lib/provvigioniRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { provvigioniWhere } from "@/lib/provvigioni";
import type { SessionUser } from "@/lib/permissions";
import { rangeMeseIncassi } from "@/lib/incassiMeseFiltro";

export type GuadagnoMeseOperatore = {
  perOperatore: Record<string, number>;
  totale: number;
};

export async function guadagnoMesePerOperatore(
  user: SessionUser,
  opts: {
    praticaWhere: Prisma.PraticaWhereInput;
    incMese?: string;
    operatorIds: string[];
  }
): Promise<GuadagnoMeseOperatore> {
  const operatorIds = opts.operatorIds.filter(Boolean);
  const perOperatore = Object.fromEntries(operatorIds.map((id) => [id, 0])) as Record<
    string,
    number
  >;
  if (!operatorIds.length) return { perOperatore, totale: 0 };

  const { inizio, fine } = rangeMeseIncassi(opts.incMese);
  const rows = await provvigioniDbFromUser(user).findMany({
    where: {
      AND: [
        provvigioniWhere(user),
        { operatoreId: { in: operatorIds } },
        { pratica: opts.praticaWhere },
        { incasso: { data: { gte: inizio, lte: fine } } },
      ],
    },
    select: { operatoreId: true, importo: true },
  });

  let totale = 0;
  for (const row of rows) {
    if (!(row.operatoreId in perOperatore)) continue;
    const importo = row.importo || 0;
    perOperatore[row.operatoreId] = (perOperatore[row.operatoreId] || 0) + importo;
    totale += importo;
  }

  const fissi = await usersDbFromUser(user).findMany({
    where: {
      tenantId: user.tenantId,
      id: { in: operatorIds },
      condizioneEconomica: "FISSO_PROVV",
      importoFisso: { gt: 0 },
      active: true,
    },
    select: { id: true, importoFisso: true },
  });
  for (const op of fissi) {
    const fisso = op.importoFisso ?? 0;
    if (!fisso) continue;
    perOperatore[op.id] = (perOperatore[op.id] || 0) + fisso;
    totale += fisso;
  }

  return { perOperatore, totale };
}
