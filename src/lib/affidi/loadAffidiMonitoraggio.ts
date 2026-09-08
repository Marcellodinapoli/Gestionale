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
  perimetro?: string,
  numeriMandante?: string[]
): Prisma.PraticaWhereInput {
  const numeri =
    numeriMandante?.length
      ? numeriMandante
      : perimetro
        ? [perimetro]
        : [];
  return {
    tenantId,
    ...(mandanteId ? { mandanteId } : {}),
    ...(numeri.length === 1
      ? { numeroMandante: numeri[0] }
      : numeri.length > 1
        ? { numeroMandante: { in: numeri } }
        : {}),
  };
}

export async function loadAffidiMonitoraggio(
  user: SessionUser,
  opts: {
    mandanteId?: string;
    perimetro?: string;
    numeriMandante?: string[];
    mese?: string;
  }
): Promise<AffidiMonitoraggioDto> {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const tra7gg = new Date(oggi);
  tra7gg.setDate(tra7gg.getDate() + 7);

  const praticaWhere = praticaMonitorWhere(
    user.tenantId,
    opts.mandanteId,
    opts.perimetro,
    opts.numeriMandante
  );

  const [nuove, inLavorazione, inScadenza7gg, nonAssegnate] = await Promise.all([
      prisma.pratica.count({
        where: { ...praticaWhere, stato: "NUOVA" },
      }),
      prisma.pratica.count({
        where: {
          ...praticaWhere,
          stato: { in: ["IN_LAVORAZIONE", "AFFIDATA", "PROMESSA", "PIANO"] },
        },
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
