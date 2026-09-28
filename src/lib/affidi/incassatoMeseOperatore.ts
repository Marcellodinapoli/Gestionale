import "server-only";
import type { Prisma } from "@prisma/client";
import { provvigioniDbFromUser } from "@/lib/provvigioniRepo";
import { provvigioniWhere } from "@/lib/provvigioni";
import type { SessionUser } from "@/lib/permissions";
import { rangeMeseIncassi } from "@/lib/incassiMeseFiltro";

export type IncassatoMeseOperatore = {
  perOperatore: Record<string, number>;
  totale: number;
};

/**
 * Incassato per operatore = somma degli incassi collegati alle sue provvigioni
 * (OperatoreId), non UserId di chi ha registrato l’incasso.
 */
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
  const rows = await provvigioniDbFromUser(user).findMany({
    where: {
      AND: [
        provvigioniWhere(user),
        { operatoreId: { in: operatorIds } },
        { pratica: opts.praticaWhere },
        { incasso: { data: { gte: inizio, lte: fine } } },
      ],
    },
    select: {
      operatoreId: true,
      incassoId: true,
      incasso: { select: { importo: true } },
    },
  });

  const seen = new Set<string>();
  let totale = 0;
  for (const row of rows) {
    const opId = row.operatoreId as string;
    const incassoId = String(
      (row as { incassoId?: string }).incassoId || ""
    );
    if (!opId || !(opId in perOperatore)) continue;
    const key = `${opId}|${incassoId || Math.random()}`;
    if (incassoId && seen.has(key)) continue;
    if (incassoId) seen.add(key);
    const importo = row.incasso?.importo || 0;
    perOperatore[opId] = (perOperatore[opId] || 0) + importo;
    totale += importo;
  }

  return { perOperatore, totale };
}
