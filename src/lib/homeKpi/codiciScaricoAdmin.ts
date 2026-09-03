import "server-only";
import type { Prisma } from "@prisma/client";
import { auditRepoFromUser } from "@/lib/auditRepo";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";
import { intervalloGiornata } from "@/lib/lavorateOggiUi";
import { rangeMeseIncassi } from "@/lib/incassiMeseFiltro";
import {
  CODICI_SCARICO,
  codiceScaricoDaStato,
  type CodiceScarico,
} from "@/lib/scarico";

export type CodiceScaricoAdminRiga = {
  codice: CodiceScarico;
  oggi: number;
  mese: number;
};

export type CodiciScaricoOperatore = Record<CodiceScarico, { oggi: number; mese: number }>;

export type CodiciScaricoDettaglio = {
  riepilogo: CodiceScaricoAdminRiga[];
  perOperatore: Record<string, CodiciScaricoOperatore>;
};

function codiceDaAudit(
  action: string,
  dettaglio: string | null | undefined,
  statoCorrente?: string
): CodiceScarico | null {
  if (action === "piano") return "LPP";
  if (action === "incasso") {
    return statoCorrente === "INCASSO" ? "PTC" : null;
  }
  if (action === "stato_update") {
    return codiceScaricoDaStato((dettaglio || "").trim());
  }
  if (action === "scarico_update") {
    const codice = (dettaglio || "").trim().split(/\s+/)[0];
    return CODICI_SCARICO.includes(codice as CodiceScarico) ? (codice as CodiceScarico) : null;
  }
  if (action === "contatto_update") {
    const tokens = (dettaglio || "").trim().split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (CODICI_SCARICO.includes(t as CodiceScarico)) return t as CodiceScarico;
    }
  }
  return null;
}

function emptySets(): Record<CodiceScarico, { oggi: Set<string>; mese: Set<string> }> {
  return {
    PTC: { oggi: new Set(), mese: new Set() },
    PPC: { oggi: new Set(), mese: new Set() },
    MOV: { oggi: new Set(), mese: new Set() },
    LPP: { oggi: new Set(), mese: new Set() },
    LPT: { oggi: new Set(), mese: new Set() },
  };
}

export function emptyCodiciScaricoOperatore(): CodiciScaricoOperatore {
  return Object.fromEntries(
    CODICI_SCARICO.map((codice) => [codice, { oggi: 0, mese: 0 }])
  ) as CodiciScaricoOperatore;
}

export function scarichiOperatoreDaRiepilogo(
  righe: CodiceScaricoAdminRiga[]
): CodiciScaricoOperatore {
  const out = emptyCodiciScaricoOperatore();
  for (const r of righe) {
    out[r.codice] = { oggi: r.oggi, mese: r.mese };
  }
  return out;
}

function setsToRighe(
  perCodice: Record<CodiceScarico, { oggi: Set<string>; mese: Set<string> }>
): CodiceScaricoAdminRiga[] {
  return CODICI_SCARICO.map((codice) => ({
    codice,
    oggi: perCodice[codice].oggi.size,
    mese: perCodice[codice].mese.size,
  }));
}

function setsToOperatore(
  perCodice: Record<CodiceScarico, { oggi: Set<string>; mese: Set<string> }>
): CodiciScaricoOperatore {
  return Object.fromEntries(
    CODICI_SCARICO.map((codice) => [
      codice,
      { oggi: perCodice[codice].oggi.size, mese: perCodice[codice].mese.size },
    ])
  ) as CodiciScaricoOperatore;
}

export async function riepilogoCodiciScaricoDettaglio(
  user: SessionUser,
  opts: {
    praticaWhere: Prisma.PraticaWhereInput;
    incMese?: string;
    operatorIds?: string[];
  }
): Promise<CodiciScaricoDettaglio> {
  const operatorIds = new Set(opts.operatorIds ?? []);
  const empty = (): CodiciScaricoDettaglio => ({
    riepilogo: CODICI_SCARICO.map((codice) => ({ codice, oggi: 0, mese: 0 })),
    perOperatore: Object.fromEntries(
      [...operatorIds].map((id) => [id, emptyCodiciScaricoOperatore()])
    ),
  });

  const pratiche = await praticaDbFromUser(user).findMany({
    where: opts.praticaWhere,
    select: { id: true, stato: true },
  });
  if (!pratiche.length) return empty();

  const statoById = new Map(pratiche.map((p) => [p.id, p.stato]));
  const ids = pratiche.map((p) => p.id);
  const { gte: gteOggi, lt: ltOggi } = intervalloGiornata(new Date());
  const { inizio: inizioMese, fine: fineMese } = rangeMeseIncassi(opts.incMese);
  const fineMeseEsclusiva = new Date(fineMese);
  fineMeseEsclusiva.setMilliseconds(fineMeseEsclusiva.getMilliseconds() + 1);

  const auditRepo = auditRepoFromUser(user);
  const logs = await auditRepo.list(user.tenantSlug ?? user.tenantId, user.tenantId, {
    createdAtGte: inizioMese.toISOString(),
    createdAtLt: fineMeseEsclusiva.toISOString(),
    entity: "pratica",
    entityIdsIn: ids,
    action: ["stato_update", "piano", "incasso", "contatto_update", "scarico_update"],
    orderBy: "asc",
    take: 25000,
  });

  const totale = emptySets();
  const perOperatoreSets = new Map<
    string,
    Record<CodiceScarico, { oggi: Set<string>; mese: Set<string> }>
  >();
  for (const id of operatorIds) {
    perOperatoreSets.set(id, emptySets());
  }

  for (const log of logs) {
    const praticaId = log.entityId;
    if (!praticaId) continue;
    const codice = codiceDaAudit(log.action, log.dettaglio, statoById.get(praticaId));
    if (!codice) continue;

    totale[codice].mese.add(praticaId);
    const created = new Date(log.createdAt);
    const isOggi = created >= gteOggi && created < ltOggi;
    if (isOggi) totale[codice].oggi.add(praticaId);

    const userId = log.userId;
    if (!userId || !operatorIds.has(userId)) continue;
    const bucket = perOperatoreSets.get(userId)!;
    bucket[codice].mese.add(praticaId);
    if (isOggi) bucket[codice].oggi.add(praticaId);
  }

  return {
    riepilogo: setsToRighe(totale),
    perOperatore: Object.fromEntries(
      [...perOperatoreSets.entries()].map(([id, sets]) => [id, setsToOperatore(sets)])
    ),
  };
}

export async function riepilogoCodiciScaricoAdmin(
  user: SessionUser,
  opts: {
    praticaWhere: Prisma.PraticaWhereInput;
    incMese?: string;
  }
): Promise<CodiceScaricoAdminRiga[]> {
  const { riepilogo } = await riepilogoCodiciScaricoDettaglio(user, opts);
  return riepilogo;
}

export function aggregaCodiciScaricoAdmin(
  logs: Array<{
    entityId: string | null;
    action: string;
    dettaglio: string | null;
    createdAt: string | Date;
    stato?: string;
  }>,
  gteOggi: Date,
  ltOggi: Date
): CodiceScaricoAdminRiga[] {
  const perCodice = emptySets();
  for (const log of logs) {
    const praticaId = log.entityId;
    if (!praticaId) continue;
    const codice = codiceDaAudit(log.action, log.dettaglio, log.stato);
    if (!codice) continue;
    perCodice[codice].mese.add(praticaId);
    const created = new Date(log.createdAt);
    if (created >= gteOggi && created < ltOggi) {
      perCodice[codice].oggi.add(praticaId);
    }
  }
  return setsToRighe(perCodice);
}
