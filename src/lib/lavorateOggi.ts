import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfToday() {
  return startOfDay(new Date());
}

export function startOfNextDay(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

export function intervalloGiornata(data: Date) {
  return { gte: startOfDay(data), lt: startOfNextDay(data) };
}

/** Fascia oraria lavorazione: mattina 09:00–13:00, pomeriggio 13:05–18:00. */
export type LavorateFascia = "mattina" | "pomeriggio";

export function parseLavorateFascia(value?: string | null): LavorateFascia | undefined {
  if (value === "mattina" || value === "pomeriggio") return value;
  return undefined;
}

export function intervalloFasciaOraria(data: Date, fascia: LavorateFascia) {
  const day = startOfDay(data);
  if (fascia === "mattina") {
    const gte = new Date(day);
    gte.setHours(9, 0, 0, 0);
    const lt = new Date(day);
    lt.setHours(13, 0, 1, 0); // include 13:00
    return { gte, lt };
  }
  const gte = new Date(day);
  gte.setHours(13, 5, 0, 0);
  const lt = new Date(day);
  lt.setHours(18, 0, 1, 0); // include 18:00
  return { gte, lt };
}

export function formatDataIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDataIso(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

export function isOggi(d: Date) {
  return formatDataIso(d) === formatDataIso(new Date());
}

export function resolveLavorateGiorno(opts: {
  lavorateData?: string | null;
  lavorateOggi?: boolean;
}): Date | undefined {
  const parsed = parseDataIso(opts.lavorateData);
  if (parsed) return parsed;
  if (opts.lavorateOggi) return startOfToday();
  return undefined;
}

export type PraticaLavorataOggi = {
  praticaId: string;
  userId: string;
  sigla: string;
  name: string;
};

export type OperatoreLavorateGiorno = {
  userId: string;
  name: string;
  sigla: string;
  count: number;
  cambiCodice: number;
};

export type CodiceLavorazioneConteggio = {
  codice: CodiceScarico;
  pratiche: number;
};

export type RiepilogoCodiciLavorazione = {
  codici: CodiceLavorazioneConteggio[];
  /** Pratiche ancora senza codice scarico (non lavorate / esito non assegnato). */
  senzaCodice: number;
  totalePratiche: number;
};

export type PraticaCambioCodiceGiorno = {
  praticaId: string;
  numero: string;
  debitore: string;
  /** Etichetta leggibile dello stato/esito precedente. */
  da: string;
  /** Etichetta leggibile dello stato/esito nuovo. */
  a: string;
  /** Operatore che ha effettuato l'ultimo cambio nel giorno. */
  userId: string | null;
};

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

  const visibili = await prisma.pratica.findMany({
    where: praticaScope,
    select: { id: true, stato: true },
  });
  const visibiliIds = new Set(visibili.map((p) => p.id));
  const statoById = new Map(visibili.map((p) => [p.id, p.stato]));

  if (!visibiliIds.size) {
    return new Map<string, Set<CodiceScarico>>();
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte, lt },
      entity: "pratica",
      entityId: { in: [...visibiliIds] },
      action: { in: ["stato_update", "piano", "incasso"] },
    },
    select: { action: true, entityId: true, dettaglio: true },
    orderBy: { createdAt: "asc" },
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

  const attivita = await prisma.attivita.findMany({
    where: {
      ...attivitaLavorazioneWhere,
      createdAt: { gte, lt },
      pratica: praticaScope,
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

  const visibili = await prisma.pratica.findMany({
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

  const visibili = await prisma.pratica.findMany({
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

  const [logsGiorno, logsPrima] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte, lt },
        entity: "pratica",
        entityId: { in: visibiliIds },
        action: { in: ["stato_update", "piano", "incasso", "contatto_update", "scarico_update"] },
      },
      select: { action: true, entityId: true, dettaglio: true, createdAt: true, userId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: { lt: gte },
        entity: "pratica",
        entityId: { in: visibiliIds },
        action: { in: ["stato_update", "piano", "incasso", "contatto_update", "scarico_update"] },
      },
      select: { action: true, entityId: true, dettaglio: true, createdAt: true, userId: true },
      orderBy: { createdAt: "desc" },
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
