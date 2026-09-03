import "server-only";
import type { Prisma } from "@prisma/client";
import { incassiDbFromUser } from "@/lib/incassiRepo";
import { provvigioniDbFromUser } from "@/lib/provvigioniRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { provvigioniWhere } from "@/lib/provvigioni";
import type { SessionUser } from "@/lib/permissions";

export type RigaMeseIncassoGuadagno = {
  meseKey: string;
  label: string;
  incassato: number;
  guadagno: number;
};

export async function incassiGuadagnoAnnoOperatore(
  user: SessionUser,
  opts: {
    operatoreId: string;
    year: number;
    praticaWhere: Prisma.PraticaWhereInput;
  }
): Promise<RigaMeseIncassoGuadagno[]> {
  const inizio = new Date(opts.year, 0, 1, 0, 0, 0, 0);
  const fine = new Date(opts.year, 11, 31, 23, 59, 59, 999);
  const incassato = Array.from({ length: 12 }, () => 0);
  const guadagno = Array.from({ length: 12 }, () => 0);

  const [incassi, provvigioni, operatore] = await Promise.all([
    incassiDbFromUser(user).findMany({
      where: {
        userId: opts.operatoreId,
        data: { gte: inizio, lte: fine },
        pratica: opts.praticaWhere,
      },
      select: { importo: true, data: true },
    }),
    provvigioniDbFromUser(user).findMany({
      where: {
        AND: [
          provvigioniWhere(user),
          { operatoreId: opts.operatoreId },
          { pratica: opts.praticaWhere },
          { incasso: { data: { gte: inizio, lte: fine } } },
        ],
      },
      select: { importo: true, incasso: { select: { data: true } } },
    }),
    usersDbFromUser(user).findFirst({
      where: { id: opts.operatoreId, tenantId: user.tenantId, active: true },
      select: { condizioneEconomica: true, importoFisso: true },
    }),
  ]);

  for (const row of incassi) {
    const m = new Date(row.data).getMonth();
    if (m >= 0 && m < 12) incassato[m] += row.importo || 0;
  }

  for (const row of provvigioni) {
    const data = row.incasso?.data;
    if (!data) continue;
    const m = new Date(data).getMonth();
    if (m >= 0 && m < 12) guadagno[m] += row.importo || 0;
  }

  const fisso =
    operatore?.condizioneEconomica === "FISSO_PROVV" && operatore.importoFisso
      ? operatore.importoFisso
      : 0;
  if (fisso > 0) {
    for (let m = 0; m < 12; m++) guadagno[m] += fisso;
  }

  return Array.from({ length: 12 }, (_, m) => {
    const d = new Date(opts.year, m, 1);
    return {
      meseKey: `${opts.year}-${String(m + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("it-IT", { month: "long" }),
      incassato: incassato[m],
      guadagno: guadagno[m],
    };
  });
}
