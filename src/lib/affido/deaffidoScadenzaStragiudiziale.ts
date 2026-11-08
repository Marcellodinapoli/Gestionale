import "server-only";
import type { Prisma } from "@prisma/client";
import { isGiudizialePrevistoSulLotto, isStragiudizialePrevistoSulLotto } from "@/lib/conferimentoLegale";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider, isNeonProvider } from "@/lib/data/factory";
import {
  isScadutaStragiudiziale,
  scadenzaStragiudizialeEffettiva,
} from "@/lib/scadenzaStragiudiziale";
import { praticaDb, type PraticaDbContext } from "@/lib/praticheRepo";

const STATI_CHIUSI = ["INCASSO", "INESIGIBILE", "RESA"] as const;

/** Perimetro con fase stragiudiziale seguita da giudiziale (conferimento «Stragiudiziale e giudiziale»). */
export function isPerimetroStragiudizialePoiGiudiziale(conferimentoTipo?: string | null): boolean {
  return (
    isStragiudizialePrevistoSulLotto(conferimentoTipo) &&
    isGiudizialePrevistoSulLotto(conferimentoTipo)
  );
}

export function deveDeaffidarePerScadenzaStragiudiziale(
  pratica: {
    conferimentoTipo?: string | null;
    scadenza?: Date | string | null;
    dataPassaggioGiudiziale?: Date | string | null;
    assegnatarioId?: string | null;
    stato?: string | null;
  },
  now = new Date()
): boolean {
  if (!pratica.assegnatarioId) return false;
  if (pratica.stato && (STATI_CHIUSI as readonly string[]).includes(pratica.stato)) {
    return false;
  }
  if (!isPerimetroStragiudizialePoiGiudiziale(pratica.conferimentoTipo)) return false;
  const eff = scadenzaStragiudizialeEffettiva({
    scadenza: pratica.scadenza,
    dataPassaggioGiudiziale: pratica.dataPassaggioGiudiziale,
    conferimentoTipo: pratica.conferimentoTipo,
  });
  return isScadutaStragiudiziale(eff, now);
}

/** Where Prisma: affidate, aperte, ENTRAMBI, scadenza stragiudiziale effettiva prima di oggi. */
export function wherePratichePerDeaffidoStragiudizialeScaduto(
  now = new Date()
): Prisma.PraticaWhereInput {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return {
    conferimentoTipo: "ENTRAMBI",
    assegnatarioId: { not: null },
    stato: { notIn: [...STATI_CHIUSI] },
    OR: [
      { dataPassaggioGiudiziale: { not: null, lt: today } },
      {
        dataPassaggioGiudiziale: null,
        scadenza: { not: null, lt: today },
      },
    ],
  };
}

const deaffidoData = {
  assegnatarioId: null,
  operatoreTitolareId: null,
  stato: "NUOVA" as const,
};

/**
 * Dal giorno dopo la scadenza stragiudiziale effettiva, le pratiche su perimetro
 * stragiudiziale→giudiziale perdono l'affidatario (come «nessuno» in Affida).
 */
export async function ensureDeaffidoStragiudizialeScaduto(
  ctx: PraticaDbContext,
  now = new Date()
): Promise<number> {
  const where: Prisma.PraticaWhereInput = {
    tenantId: ctx.tenantId,
    ...wherePratichePerDeaffidoStragiudizialeScaduto(now),
  };

  if (!isNeonProvider() && !isConnectorProvider()) {
    const result = await prisma.pratica.updateMany({ where, data: deaffidoData });
    return result.count;
  }

  const model = praticaDb({ ...ctx, skipRoleScope: true });
  const rows = await model.findMany({
    where,
    select: {
      id: true,
      conferimentoTipo: true,
      scadenza: true,
      dataPassaggioGiudiziale: true,
      assegnatarioId: true,
      stato: true,
    },
  });
  let count = 0;
  for (const row of rows) {
    if (!deveDeaffidarePerScadenzaStragiudiziale(row, now)) continue;
    await model.update({ where: { id: row.id }, data: deaffidoData });
    count += 1;
  }
  return count;
}
