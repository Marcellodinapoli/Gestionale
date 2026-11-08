import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mandantiDb } from "@/lib/mandantiRepo";
import { praticaDb, praticaDbFromUser, resolveTenantSlug } from "@/lib/praticheRepo";
import { praticaWhere } from "@/lib/domain";
import type { SessionUser } from "@/lib/permissions";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import { acronimoPerimetroLotto, parsePerimetriList } from "@/lib/mandantePerimetri";
import {
  gruppoMandantiPraticaWhere,
  type GruppoMandanteAssegnazione,
} from "@/lib/gruppoMandanti";
import { CODICI_SCARICO, codiceScaricoPratica } from "@/lib/scarico";
import { gruppoLavoroPraticaWhere } from "@/lib/gruppoLavoro";
import { isPraticaDaAffidareGruppoHome } from "@/lib/affidi/affidiPraticaStatoUi";

export {
  COLONNE_CODICI,
  emptyConteggi,
  type CodiceConteggioKey,
  type RigaCodiciMandantePerimetro,
  type RigaCodiciMandantePerimetroOperatore,
  type RigaInLavorazionePerimetro,
  type RigaDaAffidarePerimetro,
} from "@/lib/codiciMandantePerimetroUi";

import {
  emptyConteggi,
  type CodiceConteggioKey,
  type RigaCodiciMandantePerimetro,
  type RigaCodiciMandantePerimetroOperatore,
  type RigaInLavorazionePerimetro,
  type RigaDaAffidarePerimetro,
} from "@/lib/codiciMandantePerimetroUi";

export type GruppoPerimetroOpts = {
  /**
   * Se valorizzato (operatore/supervisor in un gruppo), limita ai perimetri del gruppo.
   * Array vuoto = gruppo senza perimetri → nessun dato.
   */
  gruppoMandanti?: GruppoMandanteAssegnazione[];
  /** Home supervisor: portafoglio aggregato (assegnatario/titolare tra i membri). */
  portfolioMemberIds?: string[];
};

/** Where Prisma per i perimetri del gruppo; `null` se non configurati. */
export async function gruppoPerimetroScopeWhere(
  tenantId: string,
  assegnazioni: GruppoMandanteAssegnazione[]
): Promise<Prisma.PraticaWhereInput | null> {
  if (!assegnazioni.length) return null;
  const mandantiRows = await mandantiDb({ tenantId, tenantSlug: tenantId }).findMany({
    where: {
      tenantId,
      id: { in: [...new Set(assegnazioni.map((a) => a.mandanteId))] },
    },
    select: { id: true, perimetri: true },
  });
  const mandanti = mandantiRows.map((m) => ({
    id: m.id,
    perimetri: parsePerimetriList(m.perimetri),
    perimetriRaw: m.perimetri,
  }));
  return gruppoMandantiPraticaWhere(assegnazioni, mandanti);
}

/** Home KPI gruppo: stesso ambito delle card (senza filtro stragiudiziale operatore/supervisor). */
function praticaModelCodiciHome(user: SessionUser, opts?: GruppoPerimetroOpts) {
  if (opts?.portfolioMemberIds?.length) {
    return praticaDb({
      tenantId: user.tenantId,
      tenantSlug: resolveTenantSlug(user),
      role: user.role,
      userId: user.id,
      skipRoleScope: true,
    });
  }
  return praticaDbFromUser(user);
}

async function whereConGruppoPerimetro(
  user: SessionUser,
  extra: Prisma.PraticaWhereInput,
  opts?: GruppoPerimetroOpts
): Promise<Prisma.PraticaWhereInput | null> {
  const portfolio: Prisma.PraticaWhereInput =
    opts?.portfolioMemberIds?.length
      ? {
          AND: [{ tenantId: user.tenantId }, gruppoLavoroPraticaWhere(opts.portfolioMemberIds)],
        }
      : praticaWhere(user);
  const base: Prisma.PraticaWhereInput = {
    AND: [portfolio, extra],
  };
  // Home supervisor: solo portafoglio membri (mandato/perimetro dalle pratiche affidate).
  if (opts?.portfolioMemberIds?.length) return base;
  if (opts?.gruppoMandanti === undefined) return base;
  if (!opts.gruppoMandanti.length) {
    return opts.portfolioMemberIds?.length ? base : null;
  }
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

  const praticaModel = praticaModelCodiciHome(user, opts);
  const pratiche = await praticaModel.findMany({
    where,
    include: {
      mandante: { select: { codice: true, ragioneSociale: true, perimetri: true } },
      importBatch: { select: { perimetro: true } },
    },
  });

  const byKey = new Map<string, RigaCodiciMandantePerimetro>();

  for (const p of pratiche) {
    const perimetro = acronimoPerimetroLotto(
      p.mandante?.perimetri,
      p.numeroMandante || "",
      p.importBatch?.perimetro
    );
    const key = `${p.mandanteId}|${perimetro}`;
    let row = byKey.get(key);
    if (!row) {
      const m = mandanteLabel(p.mandante);
      row = rigaCodiciVuota({
        mandanteId: p.mandanteId,
        mandanteCodice: m.codice,
        mandanteNome: m.nome,
        perimetro,
      });
      byKey.set(key, row);
    }
    accumulaMetricheRiga(row, p);
    accumulaCodiciScaricoRiga(row, p);
  }

  return sortPerimetroRows([...byKey.values()]);
}

function sortCodiciPerOperatoreRows(
  rows: RigaCodiciMandantePerimetroOperatore[]
): RigaCodiciMandantePerimetroOperatore[] {
  return [...rows].sort((a, b) => {
    const op = a.operatoreNome.localeCompare(b.operatoreNome, "it");
    if (op !== 0) return op;
    const m = a.mandanteCodice.localeCompare(b.mandanteCodice, "it");
    if (m !== 0) return m;
    if (a.perimetro === "—" && b.perimetro !== "—") return 1;
    if (b.perimetro === "—" && a.perimetro !== "—") return -1;
    return a.perimetro.localeCompare(b.perimetro, "it", { numeric: true });
  });
}

/** Come codiciPerMandantePerimetro, con riga per operatore × mandante × perimetro (portafoglio gruppo). */
export async function codiciPerMandantePerimetroPerOperatore(
  user: SessionUser,
  opts?: GruppoPerimetroOpts,
  membri?: Array<{ id: string; name: string }>
): Promise<RigaCodiciMandantePerimetroOperatore[]> {
  const where = await whereConGruppoPerimetro(
    user,
    { stato: { notIn: [...STATI_PRATICA_CHIUSA] } },
    opts
  );
  if (!where) return [];

  const nameById = new Map((membri ?? []).map((m) => [m.id, m.name]));
  const praticaModel = praticaModelCodiciHome(user, opts);
  const pratiche = await praticaModel.findMany({
    where,
    include: {
      mandante: { select: { codice: true, ragioneSociale: true, perimetri: true } },
      importBatch: { select: { perimetro: true } },
    },
  });

  const byKey = new Map<string, RigaCodiciMandantePerimetroOperatore>();

  for (const p of pratiche) {
    const operatoreId = p.assegnatarioId || p.operatoreTitolareId;
    if (!operatoreId) continue;

    const perimetro = acronimoPerimetroLotto(
      p.mandante?.perimetri,
      p.numeroMandante || "",
      p.importBatch?.perimetro
    );
    const key = `${operatoreId}|${p.mandanteId}|${perimetro}`;
    let row = byKey.get(key);
    if (!row) {
      const m = mandanteLabel(p.mandante);
      row = {
        ...rigaCodiciVuota({
          mandanteId: p.mandanteId,
          mandanteCodice: m.codice,
          mandanteNome: m.nome,
          perimetro,
        }),
        operatoreId,
        operatoreNome: nameById.get(operatoreId) ?? "—",
      };
      byKey.set(key, row);
    }
    accumulaMetricheRiga(row, p);
    accumulaCodiciScaricoRiga(row, p);
  }

  return sortCodiciPerOperatoreRows([...byKey.values()]);
}

/** Pratiche in lavorazione per mandante e perimetro. Con gruppo: solo perimetri del gruppo. */
const STATI_IN_LAVORAZIONE = ["AFFIDATA", "IN_LAVORAZIONE", "PROMESSA"] as const;

const STATI_ESCLUSI_SCADUTE = ["INCASSO", "RESA", "INESIGIBILE", "CHIUSA"] as const;

function inizioOggiLocale() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Scadenza superata, pratica ancora aperta (indipendente da giudiziale/legale). */
function praticaScadutaAperta(stato: string, scadenza: Date | null | undefined) {
  const oggi = inizioOggiLocale();
  return Boolean(
    scadenza && scadenza < oggi && !STATI_ESCLUSI_SCADUTE.includes(stato as never)
  );
}

/** Fase in lavorazione: stato operativo e non scaduta (le scadute non restano in lavorazione). */
function praticaInLavorazioneFase(stato: string, scadenza: Date | null | undefined) {
  if (!(STATI_IN_LAVORAZIONE as readonly string[]).includes(stato)) return false;
  return !praticaScadutaAperta(stato, scadenza);
}

function wherePraticaInLavorazioneFase(): Prisma.PraticaWhereInput {
  const oggi = inizioOggiLocale();
  return {
    stato: { in: [...STATI_IN_LAVORAZIONE] },
    OR: [{ scadenza: null }, { scadenza: { gte: oggi } }],
  };
}

function metricheRigaPratica(stato: string, scadenza: Date | null | undefined) {
  const scaduta = praticaScadutaAperta(stato, scadenza);
  const inLavorazione = praticaInLavorazioneFase(stato, scadenza);
  return { scaduta, inLavorazione };
}

function rigaCodiciVuota(
  partial: Omit<RigaCodiciMandantePerimetro, "affidate" | "scadute" | "inLavorazione" | "conteggi" | "totale">
): RigaCodiciMandantePerimetro {
  return {
    ...partial,
    affidate: 0,
    scadute: 0,
    inLavorazione: 0,
    conteggi: emptyConteggi(),
    totale: 0,
  };
}

function accumulaMetricheRiga(
  row: RigaCodiciMandantePerimetro,
  p: { assegnatarioId: string | null; stato: string; scadenza: Date | null | undefined }
) {
  if (p.assegnatarioId) row.affidate += 1;
  const m = metricheRigaPratica(p.stato, p.scadenza);
  if (m.scaduta) row.scadute += 1;
  if (m.inLavorazione) row.inLavorazione += 1;
}

function accumulaCodiciScaricoRiga(
  row: RigaCodiciMandantePerimetro,
  p: {
    stato: string;
    scadenza: Date | null | undefined;
    codiceScarico: string | null;
  }
) {
  if (!praticaInLavorazioneFase(p.stato, p.scadenza)) return;
  const codice = codiceScaricoPratica(p.stato, p.codiceScarico);
  const slot: CodiceConteggioKey =
    codice != null && (CODICI_SCARICO as readonly string[]).includes(codice)
      ? (codice as CodiceConteggioKey)
      : "ND";
  row.conteggi[slot] += 1;
  row.totale += 1;
}

export async function inLavorazionePerPerimetro(
  user: SessionUser,
  opts?: GruppoPerimetroOpts
): Promise<RigaInLavorazionePerimetro[]> {
  const where = await whereConGruppoPerimetro(user, wherePraticaInLavorazioneFase(), opts);
  if (!where) return [];

  const praticaModel = praticaDbFromUser(user);
  const pratiche = await praticaModel.findMany({
    where,
    include: {
      mandante: { select: { codice: true, perimetri: true } },
      importBatch: { select: { perimetro: true } },
    },
  });

  const byKey = new Map<string, RigaInLavorazionePerimetro>();
  for (const p of pratiche) {
    const perimetro = acronimoPerimetroLotto(
      p.mandante?.perimetri,
      p.numeroMandante || "",
      p.importBatch?.perimetro
    );
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
  gruppoMandanti: GruppoMandanteAssegnazione[],
  tenantSlug?: string
): Promise<RigaDaAffidarePerimetro[]> {
  const scope = await gruppoPerimetroScopeWhere(tenantId, gruppoMandanti);
  if (!scope) return [];

  const pratiche = await praticaDb({
    tenantId,
    tenantSlug: tenantSlug ?? tenantId,
    role: "ADMIN",
    userId: tenantId,
  }).findMany({
    where: {
      tenantId,
      assegnatarioId: null,
      stato: { notIn: [...STATI_PRATICA_CHIUSA] },
      ...scope,
    },
    select: {
      mandanteId: true,
      numeroMandante: true,
      stato: true,
      assegnatarioId: true,
      scadenza: true,
      dataPassaggioGiudiziale: true,
      conferimentoTipo: true,
      codiceScaricoBk: true,
      giudiziale: { select: { statoAvvio: true } },
      mandante: { select: { codice: true, perimetri: true } },
      importBatch: { select: { perimetro: true } },
    },
  });

  const byKey = new Map<string, RigaDaAffidarePerimetro>();
  for (const p of pratiche) {
    if (
      !isPraticaDaAffidareGruppoHome({
        stato: p.stato,
        assegnatarioId: p.assegnatarioId,
        scadenza: p.scadenza,
        codiceScaricoBk: p.codiceScaricoBk,
        dataPassaggioGiudiziale: p.dataPassaggioGiudiziale,
        conferimentoTipo: p.conferimentoTipo,
        statoAvvioGiudiziale: p.giudiziale?.statoAvvio ?? null,
      })
    ) {
      continue;
    }
    const perimetro = acronimoPerimetroLotto(
      p.mandante?.perimetri,
      p.numeroMandante || "",
      p.importBatch?.perimetro
    );
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

