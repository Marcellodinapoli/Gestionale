import { prisma } from "@/lib/prisma";
import { operatorSigla } from "@/lib/noteFormat";
import type { SessionUser } from "@/lib/permissions";
import { praticaWhere } from "@/lib/domain";
import { gruppoLavoroPraticaWhere } from "@/lib/gruppoLavoro";
import {
  CODICI_SCARICO,
  codiceScaricoDaStato,
  codiceScaricoPratica,
  type CodiceScarico,
} from "@/lib/scarico";

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
  opts?: { data?: Date; memberIds?: string[] }
): Promise<PraticaLavorataOggi[]> {
  const data = opts?.data ?? startOfToday();
  const { gte, lt } = intervalloGiornata(data);

  const praticaScope = opts?.memberIds?.length
    ? gruppoLavoroPraticaWhere(opts.memberIds)
    : praticaWhere(user);

  const attivita = await prisma.attivita.findMany({
    where: {
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
  opts?: { data?: Date; memberIds?: string[] }
): Promise<RiepilogoCodiciLavorazione> {
  const data = opts?.data ?? startOfToday();
  const { gte, lt } = intervalloGiornata(data);

  const praticaScope = opts?.memberIds?.length
    ? gruppoLavoroPraticaWhere(opts.memberIds)
    : praticaWhere(user);

  const visibili = await prisma.pratica.findMany({
    where: praticaScope,
    select: { id: true, stato: true, codiceScarico: true },
  });
  const visibiliIds = new Set(visibili.map((p) => p.id));
  const statoById = new Map(visibili.map((p) => [p.id, p.stato]));
  const senzaCodice = visibili.filter(
    (p) => !codiceScaricoPratica(p.stato, p.codiceScarico)
  ).length;

  if (!visibiliIds.size) {
    return { codici: [], senzaCodice: 0, totalePratiche: 0 };
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

/** Conteggio pratiche lavorate nel giorno, separato per operatore (ultima attività del giorno). */
export async function lavoratePerOperatoreInGiornata(
  user: SessionUser,
  opts?: { data?: Date; memberIds?: string[] }
): Promise<OperatoreLavorateGiorno[]> {
  const items = await praticheLavorateInGiornata(user, opts);
  return raggruppaPerOperatore(items);
}
