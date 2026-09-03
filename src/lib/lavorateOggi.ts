import type { Prisma } from "@prisma/client";
import { auditRepoFromUser } from "@/lib/auditRepo";
import { attivitaDbFromUser } from "@/lib/attivitaRepo";
import { praticaDb, praticaDbFromUser, type PraticaDbContext } from "@/lib/praticheRepo";
import { operatorSigla } from "@/lib/noteFormat";
import type { SessionUser } from "@/lib/permissions";
import { STATO_LABELS } from "@/lib/permissions";
import { praticaWhere } from "@/lib/domain";
import { gruppoLavoroPraticaWhere } from "@/lib/gruppoLavoro";
import { ESITO_CONTATTO_LABELS } from "@/lib/contatto";
import {
  CODICI_SCARICO,
  CODICE_SCARICO_LABELS,
  codiceScaricoDaStato,
  codiceScaricoPratica,
  type CodiceScarico,
} from "@/lib/scarico";
import { attivitaLavorazioneWhere } from "@/lib/praticaOrdine";

export {
  startOfDay,
  startOfToday,
  startOfNextDay,
  intervalloGiornata,
  parseLavorateFascia,
  intervalloFasciaOraria,
  formatDataIso,
  parseDataIso,
  isOggi,
  resolveLavorateGiorno,
  type LavorateFascia,
  type PraticaLavorataOggi,
  type OperatoreLavorateGiorno,
  type CodiceLavorazioneConteggio,
  type RiepilogoCodiciLavorazione,
  type PraticaCambioCodiceGiorno,
} from "@/lib/lavorateOggiUi";

import {
  startOfDay,
  startOfToday,
  startOfNextDay,
  intervalloGiornata,
  intervalloFasciaOraria,
  type LavorateFascia,
  type PraticaLavorataOggi,
  type OperatoreLavorateGiorno,
  type RiepilogoCodiciLavorazione,
  type PraticaCambioCodiceGiorno,
} from "@/lib/lavorateOggiUi";

async function resolvePraticaScope(
  user: SessionUser,
  opts?: { data?: Date; memberIds?: string[]; scopeWhere?: Prisma.PraticaWhereInput }
): Promise<Prisma.PraticaWhereInput> {
  if (opts?.scopeWhere) return opts.scopeWhere;
  if (opts?.memberIds?.length) return gruppoLavoroPraticaWhere(opts.memberIds);
  return praticaWhere(user);
}

async function mapCodiciCambiatiInGiornata(
  user: SessionUser,
  opts?: { data?: Date; memberIds?: string[]; scopeWhere?: Prisma.PraticaWhereInput }
) {
  const data = opts?.data ?? startOfToday();
  const { gte, lt } = intervalloGiornata(data);

  const praticaScope = await resolvePraticaScope(user, opts);
  const praticaModel = praticaDbFromUser(user);

  const visibili = await praticaModel.findMany({
    where: praticaScope,
    select: { id: true, stato: true },
  });
  const visibiliIds = new Set(visibili.map((p) => p.id));
  const statoById = new Map(visibili.map((p) => [p.id, p.stato]));

  if (!visibiliIds.size) {
    return new Map<string, Set<CodiceScarico>>();
  }

  const auditRepo = auditRepoFromUser(user);
  const logs = await auditRepo.list(user.tenantSlug ?? user.tenantId, user.tenantId, {
    createdAtGte: gte.toISOString(),
    createdAtLt: lt.toISOString(),
    entity: "pratica",
    entityIdsIn: [...visibiliIds],
    action: ["stato_update", "piano", "incasso"],
    orderBy: "asc",
    take: 5000,
  });

  const perPratica = new Map<string, Set<CodiceScarico>>();

  function registraCodice(praticaId: string, codice: CodiceScarico | null) {
    if (!codice || !visibiliIds.has(praticaId)) return;
    const set = perPratica.get(praticaId) ?? new Set<CodiceScarico>();
    set.add(codice);
    perPratica.set(praticaId, set);
  }

  for (const log of logs) {
    const praticaId = log.entityId;
    if (!praticaId) continue;
    if (log.action === "stato_update") {
      registraCodice(praticaId, codiceScaricoDaStato(log.dettaglio || ""));
    } else if (log.action === "piano") {
      registraCodice(praticaId, "LPP");
    } else if (log.action === "incasso" && statoById.get(praticaId) === "INCASSO") {
      registraCodice(praticaId, "PTC");
    }
  }

  return perPratica;
}

function raggruppaPerOperatore(items: PraticaLavorataOggi[]): OperatoreLavorateGiorno[] {
  const byOp = new Map<string, OperatoreLavorateGiorno>();
  for (const item of items) {
    const row = byOp.get(item.userId);
    if (row) row.count += 1;
    else {
      byOp.set(item.userId, {
        userId: item.userId,
        name: item.name,
        sigla: item.sigla,
        count: 1,
        cambiCodice: 0,
      });
    }
  }
  return [...byOp.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "it")
  );
}

/** Una voce per pratica: ultima attività nel giorno indicato (default oggi). */
export async function praticheLavorateInGiornata(
  user: SessionUser,
  opts?: { data?: Date; memberIds?: string[]; scopeWhere?: Prisma.PraticaWhereInput }
): Promise<PraticaLavorataOggi[]> {
  const data = opts?.data ?? startOfToday();
  const { gte, lt } = intervalloGiornata(data);

  const praticaScope = await resolvePraticaScope(user, opts);
  const praticaModel = praticaDbFromUser(user);

  const praticaIdsVisibili = (
    await praticaModel.findMany({
      where: praticaScope,
      select: { id: true },
    })
  ).map((p) => p.id);
  if (!praticaIdsVisibili.length) return [];

  const attivita = await attivitaDbFromUser(user).findMany({
    where: {
      ...attivitaLavorazioneWhere,
      createdAt: { gte, lt },
      praticaId: { in: praticaIdsVisibili },
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const seen = new Set<string>();
  const items: PraticaLavorataOggi[] = [];
  for (const a of attivita) {
    if (seen.has(a.praticaId)) continue;
    seen.add(a.praticaId);
    items.push({
      praticaId: a.praticaId,
      userId: a.userId,
      sigla: operatorSigla(a.user.name),
      name: a.user.name,
    });
  }
  return items;
}

/** Codici scarico toccati nel giorno (da cambi stato, piano o incasso totale). */
export async function riepilogoCodiciLavorazioneInGiornata(
  user: SessionUser,
  opts?: { data?: Date; memberIds?: string[]; scopeWhere?: Prisma.PraticaWhereInput }
): Promise<RiepilogoCodiciLavorazione> {
  const praticaScope = await resolvePraticaScope(user, opts);
  const praticaModel = praticaDbFromUser(user);

  const visibili = await praticaModel.findMany({
    where: praticaScope,
    select: { id: true, stato: true, codiceScarico: true },
  });
  const senzaCodice = visibili.filter(
    (p) => !codiceScaricoPratica(p.stato, p.codiceScarico)
  ).length;

  const perPratica = await mapCodiciCambiatiInGiornata(user, opts);

  const perCodice = new Map<CodiceScarico, number>();
  for (const codici of perPratica.values()) {
    for (const codice of codici) {
      perCodice.set(codice, (perCodice.get(codice) || 0) + 1);
    }
  }

  const codici = CODICI_SCARICO.filter((c) => perCodice.has(c)).map((codice) => ({
    codice,
    pratiche: perCodice.get(codice)!,
  }));

  return {
    codici,
    senzaCodice,
    totalePratiche: perPratica.size,
  };
}

/** Pratiche con cambio codice/esito nel giorno indicato (transizione da → a). */
export async function praticheConCambioCodiceInGiornata(
  user: SessionUser,
  opts?: { data?: Date; memberIds?: string[]; scopeWhere?: Prisma.PraticaWhereInput }
): Promise<PraticaCambioCodiceGiorno[]> {
  const data = opts?.data ?? startOfToday();
  const { gte, lt } = intervalloGiornata(data);

  const praticaScope = await resolvePraticaScope(user, opts);
  const praticaModel = praticaDbFromUser(user);

  const visibili = await praticaModel.findMany({
    where: praticaScope,
    select: {
      id: true,
      numero: true,
      stato: true,
      esitoContatto: true,
      debitore: { select: { nome: true, cognome: true } },
    },
  });
  if (!visibili.length) return [];

  const visibiliIds = [...visibili.map((p) => p.id)];
  const praticaById = new Map(visibili.map((p) => [p.id, p]));
  const statoById = new Map(visibili.map((p) => [p.id, p.stato]));

  const auditRepo = auditRepoFromUser(user);
  const [logsGiorno, logsPrima] = await Promise.all([
    auditRepo.list(user.tenantSlug ?? user.tenantId, user.tenantId, {
      createdAtGte: gte.toISOString(),
      createdAtLt: lt.toISOString(),
      entity: "pratica",
      entityIdsIn: visibiliIds,
      action: ["stato_update", "piano", "incasso", "contatto_update", "scarico_update"],
      orderBy: "asc",
      take: 5000,
    }),
    auditRepo.list(user.tenantSlug ?? user.tenantId, user.tenantId, {
      createdAtLt: gte.toISOString(),
      entity: "pratica",
      entityIdsIn: visibiliIds,
      action: ["stato_update", "piano", "incasso", "contatto_update", "scarico_update"],
      orderBy: "desc",
      take: 5000,
    }),
  ]);

  const ultimoPrima = new Map<string, string>();
  for (const log of logsPrima) {
    if (!log.entityId || ultimoPrima.has(log.entityId)) continue;
    const label = labelDaAudit(log.action, log.dettaglio, statoById.get(log.entityId));
    if (label) ultimoPrima.set(log.entityId, label);
  }

  type Step = { praticaId: string; label: string; userId: string | null };
  const stepsByPratica = new Map<string, Step[]>();

  for (const log of logsGiorno) {
    const praticaId = log.entityId;
    if (!praticaId || !praticaById.has(praticaId)) continue;
    const label = labelDaAudit(log.action, log.dettaglio, statoById.get(praticaId));
    if (!label) continue;
    const list = stepsByPratica.get(praticaId) ?? [];
    // Evita ripeti uguali consecutivi
    if (list.length && list[list.length - 1].label === label) continue;
    list.push({ praticaId, label, userId: log.userId });
    stepsByPratica.set(praticaId, list);
  }

  const out: PraticaCambioCodiceGiorno[] = [];
  for (const [praticaId, steps] of stepsByPratica) {
    if (!steps.length) continue;
    const p = praticaById.get(praticaId)!;
    const a = steps[steps.length - 1].label;
    const da =
      steps.length > 1
        ? steps[steps.length - 2].label
        : ultimoPrima.get(praticaId) || "Senza esito";
    if (da === a) continue;
    out.push({
      praticaId,
      numero: p.numero,
      debitore: `${p.debitore.cognome} ${p.debitore.nome}`.trim(),
      da,
      a,
      userId: steps[steps.length - 1].userId,
    });
  }

  return out.sort((x, y) => x.numero.localeCompare(y.numero, "it", { numeric: true }));
}

function labelDaAudit(
  action: string,
  dettaglio: string | null | undefined,
  statoCorrente?: string
): string | null {
  if (action === "piano") return "Piano di rientro";
  if (action === "stralcio") return "Saldo a stralcio";
  if (action === "incasso") {
    if (statoCorrente === "INCASSO") return "Incassata";
    return null;
  }
  if (action === "stato_update") {
    const stato = (dettaglio || "").trim();
    if (!stato) return null;
    const codice = codiceScaricoDaStato(stato);
    if (codice) return CODICE_SCARICO_LABELS[codice];
    return STATO_LABELS[stato] || stato;
  }
  if (action === "scarico_update") {
    const codice = (dettaglio || "").trim().split(/\s+/)[0];
    if (codice && CODICI_SCARICO.includes(codice as CodiceScarico)) {
      return CODICE_SCARICO_LABELS[codice as CodiceScarico];
    }
    return null;
  }
  if (action === "contatto_update") {
    const tokens = (dettaglio || "").trim().split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (CODICI_SCARICO.includes(t as CodiceScarico)) {
        return CODICE_SCARICO_LABELS[t as CodiceScarico];
      }
      if (ESITO_CONTATTO_LABELS[t]) return ESITO_CONTATTO_LABELS[t];
    }
    return null;
  }
  return null;
}

/** Conteggio pratiche lavorate nel giorno, separato per operatore (ultima attività del giorno). */
export async function lavoratePerOperatoreInGiornata(
  user: SessionUser,
  opts?: { data?: Date; memberIds?: string[]; scopeWhere?: Prisma.PraticaWhereInput }
): Promise<OperatoreLavorateGiorno[]> {
  const items = await praticheLavorateInGiornata(user, opts);
  return raggruppaPerOperatore(items);
}

/** Elenco completo operatori del gruppo con conteggio (0 se nessuna lavorazione nel giorno). */
export function completaOperatoriGruppo(
  operatori: OperatoreLavorateGiorno[],
  membri: Array<{ id: string; name: string; role: string }>
): OperatoreLavorateGiorno[] {
  const byId = new Map(operatori.map((o) => [o.userId, o]));
  return membri
    .filter((m) => m.role === "OPERATOR")
    .map(
      (m) =>
        byId.get(m.id) ?? {
          userId: m.id,
          name: m.name,
          sigla: operatorSigla(m.name),
          count: 0,
          cambiCodice: 0,
        }
    )
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"));
}

/** Aggiunge a ogni operatore il conteggio pratiche con codice cambiato nel giorno. */
export function applicaCambiCodicePerOperatore(
  operatori: OperatoreLavorateGiorno[],
  pratiche: PraticaCambioCodiceGiorno[]
): OperatoreLavorateGiorno[] {
  const byUser = new Map<string, number>();
  for (const p of pratiche) {
    if (!p.userId) continue;
    byUser.set(p.userId, (byUser.get(p.userId) || 0) + 1);
  }
  return operatori.map((op) => ({
    ...op,
    cambiCodice: byUser.get(op.userId) ?? 0,
  }));
}
