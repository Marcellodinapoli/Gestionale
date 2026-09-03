import "server-only";
import { prisma } from "@/lib/prisma";import type { Prisma } from "@prisma/client";

const STATI_CODA_DISPONIBILI = ["disponibile", "richiamare", "non_risposta"] as const;

type Tx = Prisma.TransactionClient;

export type LockPraticaOpts = {
  numero?: string;
  callId: string;
};

/** Blocco atomico pratica in coda: disponibile → in_lavorazione. */
export async function lockPraticaInCoda(
  campagnaId: string,
  praticaId: string,
  operatoreId: string,
  opts: LockPraticaOpts,
  tx?: Tx
): Promise<boolean> {
  const db = tx ?? prisma;
  const now = new Date();
  const result = await db.dialerCampagnaPratica.updateMany({
    where: {
      campagnaId,
      praticaId,
      stato: { in: [...STATI_CODA_DISPONIBILI] },
      lockedByOperatoreId: null,
    },
    data: {
      stato: "in_lavorazione",
      lockedByOperatoreId: operatoreId,
      lockedByCallId: opts.callId,
      lockedAt: now,
      ultimaChiamataAt: now,
      ...(opts.numero ? { numeroTelefonicoUtilizzato: opts.numero } : {}),
    },
  });
  return result.count > 0;
}

export type ReleasePraticaOpts = {
  statoCoda: "disponibile" | "non_risposta" | "richiamare";
  ultimoEsito: string;
  incrementTentativi?: boolean;
  prossimoTentativoAt?: Date | null;
  onlyIfLocked?: boolean;
  onlyIfCallId?: string;
};

/** Rilascia pratica in coda dopo tentativo fallito, timeout o non collegato. */
export async function releasePraticaInCoda(
  campagnaId: string,
  praticaId: string,
  opts: ReleasePraticaOpts,
  tx?: Tx
) {
  const db = tx ?? prisma;
  await db.dialerCampagnaPratica.updateMany({
    where: {
      campagnaId,
      praticaId,
      ...(opts.onlyIfLocked ? { stato: "in_lavorazione" } : {}),
      ...(opts.onlyIfCallId ? { lockedByCallId: opts.onlyIfCallId } : {}),
    },
    data: {
      stato: opts.statoCoda,
      lockedByOperatoreId: null,
      lockedByCallId: null,
      lockedAt: null,
      ultimoEsito: opts.ultimoEsito,
      ultimaChiamataAt: new Date(),
      prossimoTentativoAt: opts.prossimoTentativoAt ?? null,
      ...(opts.incrementTentativi ? { tentativi: { increment: 1 } } : {}),
    },
  });
}

/** Segna pratica conclusa dopo chiamata effettiva con operatore. */
export async function completePraticaInCoda(
  campagnaId: string,
  praticaId: string,
  ultimoEsito: string,
  tx?: Tx
) {
  const db = tx ?? prisma;
  await db.dialerCampagnaPratica.updateMany({
    where: { campagnaId, praticaId },
    data: {
      stato: "conclusa",
      lockedByOperatoreId: null,
      lockedByCallId: null,
      lockedAt: null,
      ultimoEsito,
      ultimaChiamataAt: new Date(),
      tentativi: { increment: 1 },
    },
  });
}
