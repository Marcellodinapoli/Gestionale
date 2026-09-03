import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions";

export type AffidiMonitoraggioDto = {
  nuove: number;
  nonAssegnate: number;
  inLavorazione: number;
  inScadenza7gg: number;
};

export function praticaMonitorWhere(
  tenantId: string,
  mandanteId?: string,
  perimetro?: string
): Prisma.PraticaWhereInput {
  return {
    tenantId,
    ...(mandanteId ? { mandanteId } : {}),
    ...(perimetro ? { numeroMandante: perimetro } : {}),
  };
}

export async function loadAffidiMonitoraggio(
  user: SessionUser,
  opts: {
    mandanteId?: string;
    perimetro?: string;
    mese?: string;
  }
): Promise<AffidiMonitoraggioDto> {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const tra7gg = new Date(oggi);
  tra7gg.setDate(tra7gg.getDate() + 7);

  const praticaWhere = praticaMonitorWhere(user.tenantId, opts.mandanteId, opts.perimetro);

  const [nuove, inLavorazione, inScadenza7gg, nonAssegnate] = await Promise.all([
      prisma.pratica.count({
        where: { ...praticaWhere, stato: "NUOVA" },
      }),
      prisma.pratica.count({
        where: { ...praticaWhere, stato: "IN_LAVORAZIONE" },
      }),
      prisma.pratica.count({
        where: {
          ...praticaWhere,
          scadenza: { gte: oggi, lte: tra7gg },
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
        },
      }),
      prisma.pratica.count({
        where: {
          ...praticaWhere,
          assegnatarioId: null,
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
        },
      }),
    ]);

  return {
    nuove,
    nonAssegnate,
    inLavorazione,
    inScadenza7gg,
  };
}
