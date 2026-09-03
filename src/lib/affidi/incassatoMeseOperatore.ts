import "server-only";
import type { Prisma } from "@prisma/client";
import { incassiDbFromUser } from "@/lib/incassiRepo";
import type { SessionUser } from "@/lib/permissions";
import { rangeMeseIncassi } from "@/lib/incassiMeseFiltro";

export type IncassatoMeseOperatore = {
  perOperatore: Record<string, number>;
  totale: number;
};

export async function incassatoMesePerOperatore(
  user: SessionUser,
  opts: {
    praticaWhere: Prisma.PraticaWhereInput;
    incMese?: string;
    operatorIds: string[];
  }
): Promise<IncassatoMeseOperatore> {
  const operatorIds = opts.operatorIds.filter(Boolean);
  const perOperatore = Object.fromEntries(operatorIds.map((id) => [id, 0])) as Record<
    string,
    number
  >;
  if (!operatorIds.length) return { perOperatore, totale: 0 };

  const { inizio, fine } = rangeMeseIncassi(opts.incMese);
  const rows = await incassiDbFromUser(user).findMany({
    where: {
      userId: { in: operatorIds },
      data: { gte: inizio, lte: fine },
      pratica: opts.praticaWhere,
    },
    select: { userId: true, importo: true },
  });

  let totale = 0;
  for (const row of rows) {
    if (!row.userId || !(row.userId in perOperatore)) continue;
    const importo = row.importo || 0;
    perOperatore[row.userId] = (perOperatore[row.userId] || 0) + importo;
    totale += importo;
  }

  return { perOperatore, totale };
}
