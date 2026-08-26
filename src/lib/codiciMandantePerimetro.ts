import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { praticaWhere } from "@/lib/domain";
import type { SessionUser } from "@/lib/permissions";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import {
  gruppoMandantiPraticaWhere,
  type GruppoMandanteAssegnazione,
} from "@/lib/gruppoMandanti";
import { codiceScaricoPratica } from "@/lib/scarico";

export {
  COLONNE_CODICI,
  emptyConteggi,
  type CodiceConteggioKey,
  type RigaCodiciMandantePerimetro,
  type RigaInLavorazionePerimetro,
  type RigaDaAffidarePerimetro,
} from "@/lib/codiciMandantePerimetroUi";

import {
  emptyConteggi,
  type CodiceConteggioKey,
  type RigaCodiciMandantePerimetro,
  type RigaInLavorazionePerimetro,
  type RigaDaAffidarePerimetro,
} from "@/lib/codiciMandantePerimetroUi";

export type GruppoPerimetroOpts = {
  /**
   * Se valorizzato (operatore/supervisor in un gruppo), limita ai perimetri del gruppo.
   * Array vuoto = gruppo senza perimetri → nessun dato.
   */
  gruppoMandanti?: GruppoMandanteAssegnazione[];
};

/** Where Prisma per i perimetri del gruppo; `null` se non configurati. */
export async function gruppoPerimetroScopeWhere(
  tenantId: string,
  assegnazioni: GruppoMandanteAssegnazione[]
): Promise<Prisma.PraticaWhereInput | null> {
  if (!assegnazioni.length) return null;
  const mandantiDb = await prisma.mandante.findMany({
    where: {
      tenantId,
      id: { in: [...new Set(assegnazioni.map((a) => a.mandanteId))] },
    },
    select: { id: true, perimetri: true },
  });
  const mandanti = mandantiDb.map((m) => ({
    id: m.id,
    perimetri: parsePerimetriList(m.perimetri),
  }));
  return gruppoMandantiPraticaWhere(assegnazioni, mandanti);
}

async function whereConGruppoPerimetro(
  user: SessionUser,
  extra: Prisma.PraticaWhereInput,
  opts?: GruppoPerimetroOpts
): Promise<Prisma.PraticaWhereInput | null> {
  const base: Prisma.PraticaWhereInput = {
    AND: [praticaWhere(user), extra],
  };
  if (opts?.gruppoMandanti === undefined) return base;
  if (!opts.gruppoMandanti.length) return null;
  const scope = await gruppoPerimetroScopeWhere(user.tenantId, opts.gruppoMandanti);
  if (!scope) return null;
  return { AND: [base, scope] };
}

function sortPerimetroRows<T extends { mandanteCodice: string; perimetro: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const m = a.mandanteCodice.localeCompare(b.mandanteCodice, "it");
    if (m !== 0) return m;
    if (a.perimetro === "—" && b.perimetro !== "—") return 1;
    if (b.perimetro === "—" && a.perimetro !== "—") return -1;
    return a.perimetro.localeCompare(b.perimetro, "it", { numeric: true });
  });
}

function mandanteLabel(
  mandante: { codice?: string; ragioneSociale?: string } | null | undefined
) {
  return {
    codice: mandante?.codice?.trim() || "—",
    nome: mandante?.ragioneSociale?.trim() || "—",
  };
}

/** Conteggio pratiche per codice scarico, suddiviso per mandante e perimetro (lotto).
 * Solo pratiche in fase “in lavorazione” (non chiuse).
 * Con gruppo: solo perimetri del gruppo. */
export async function codiciPerMandantePerimetro(
  user: SessionUser,
  opts?: GruppoPerimetroOpts
): Promise<RigaCodiciMandantePerimetro[]> {
  const where = await whereConGruppoPerimetro(
    user,
    { stato: { notIn: [...STATI_PRATICA_CHIUSA] } },
    opts
  );
  if (!where) return [];

  const pratiche = await prisma.pratica.findMany({
    where,
    include: {
      mandante: { select: { codice: true, ragioneSociale: true } },
    },
  });

  const byKey = new Map<string, RigaCodiciMandantePerimetro>();

  for (const p of pratiche) {
    const perimetro = p.numeroMandante?.trim() || "—";
    const key = `${p.mandanteId}|${perimetro}`;
    let row = byKey.get(key);
    if (!row) {
      const m = mandanteLabel(p.mandante);
      row = {
        mandanteId: p.mandanteId,
        mandanteCodice: m.codice,
        mandanteNome: m.nome,
        perimetro,
        affidate: 0,
        conteggi: emptyConteggi(),
        totale: 0,
      };
      byKey.set(key, row);
    }
    if (p.assegnatarioId) row.affidate += 1;
    const codice = codiceScaricoPratica(p.stato, p.codiceScarico);
    const slot: CodiceConteggioKey = codice ?? "ND";
    row.conteggi[slot] += 1;
    row.totale += 1;
  }

  return sortPerimetroRows([...byKey.values()]);
}

/** Pratiche in lavorazione per mandante e perimetro. Con gruppo: solo perimetri del gruppo. */
const STATI_IN_LAVORAZIONE = ["AFFIDATA", "IN_LAVORAZIONE", "PROMESSA"] as const;

export async function inLavorazionePerPerimetro(
  user: SessionUser,
  opts?: GruppoPerimetroOpts
): Promise<RigaInLavorazionePerimetro[]> {
  const where = await whereConGruppoPerimetro(
    user,
    { stato: { in: [...STATI_IN_LAVORAZIONE] } },
    opts
  );
  if (!where) return [];

  const pratiche = await prisma.pratica.findMany({
    where,
    include: {
      mandante: { select: { codice: true } },
    },
  });

  const byKey = new Map<string, RigaInLavorazionePerimetro>();
  for (const p of pratiche) {
    const perimetro = p.numeroMandante?.trim() || "—";
    const key = `${p.mandanteId}|${perimetro}`;
    const row = byKey.get(key);
    if (row) row.count += 1;
    else {
      byKey.set(key, {
        mandanteId: p.mandanteId,
        mandanteCodice: mandanteLabel(p.mandante).codice,
        perimetro,
        count: 1,
      });
    }
  }

  return sortPerimetroRows([...byKey.values()]);
}

/**
 * Pratiche aperte senza operatore, solo sui perimetri assegnati al gruppo di lavoro.
 */
export async function daAffidarePerPerimetroGruppo(
  tenantId: string,
  gruppoMandanti: GruppoMandanteAssegnazione[]
): Promise<RigaDaAffidarePerimetro[]> {
  const scope = await gruppoPerimetroScopeWhere(tenantId, gruppoMandanti);
  if (!scope) return [];

  const pratiche = await prisma.pratica.findMany({
    where: {
      tenantId,
      assegnatarioId: null,
      stato: { notIn: [...STATI_PRATICA_CHIUSA] },
      ...scope,
    },
    include: {
      mandante: { select: { codice: true } },
    },
  });

  const byKey = new Map<string, RigaDaAffidarePerimetro>();
  for (const p of pratiche) {
    const perimetro = p.numeroMandante?.trim() || "—";
    const key = `${p.mandanteId}|${perimetro}`;
    const row = byKey.get(key);
    if (row) row.count += 1;
    else {
      byKey.set(key, {
        mandanteId: p.mandanteId,
        mandanteCodice: mandanteLabel(p.mandante).codice,
        perimetro,
        count: 1,
      });
    }
  }

  return sortPerimetroRows([...byKey.values()]);
}

