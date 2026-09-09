import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorIncassiRepository } from "@/lib/data/connector/ConnectorIncassiRepository";
import type { IncassoFilter } from "@/lib/data/contracts/incassi";
import { dataIt, euro } from "@/lib/domain";
import {
  mandantiConPerimetriAffidi,
  numeriMandantePerFiltroPerimetro,
  type MandantePerimetriAffidi,
} from "@/lib/affidi/affidiMonitorPerimetri";
import {
  etichettaPerimetro,
  resolvePerimetroPratica,
} from "@/lib/mandantePerimetri";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";
import {
  MODI_INCASSO_PROVV,
  normalizeModoIncasso,
} from "@/lib/incassoFattura";
import { parseIncMeseParam, rangeMeseIncassi } from "@/lib/incassiMeseFiltro";
import { resolveTenantSlug } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type { IncassiElencoFiltri } from "@/lib/incassiElencoUi";

export type { IncassiElencoFiltri } from "@/lib/incassiElencoUi";
export {
  parseIncassiElencoFiltri,
  hasIncassiElencoFiltri,
} from "@/lib/incassiElencoUi";

function dayStart(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
}

function dayEnd(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 23, 59, 59, 999);
}

export function buildIncassoFilterFromElenco(
  f: IncassiElencoFiltri,
  mandanti: MandantePerimetriAffidi[],
  opts?: { defaultMeseCorrente?: boolean }
): IncassoFilter {
  const filter: IncassoFilter = {};

  if (f.mandato) filter.mandanteId = f.mandato;
  if (f.operatore) filter.userId = f.operatore;
  if (f.lotto) filter.numeroMandante = f.lotto;
  if (f.metodo) filter.metodo = f.metodo;
  if (f.modo === "ve" || f.modo === "np") filter.modo = f.modo;
  if (f.causale) filter.causaleContains = f.causale;
  if (f.ricevuta) filter.fatturaContains = f.ricevuta;
  if (f.citta) filter.cittaContains = f.citta;
  if (f.cliente) filter.clienteContains = f.cliente;
  if (f.capDa) filter.capDa = f.capDa;
  if (f.capA) filter.capA = f.capA;

  if (f.perimetro) {
    const numeri = numeriMandantePerFiltroPerimetro(
      mandanti,
      f.perimetro,
      f.mandato
    );
    if (numeri.length) filter.numeriMandanteIn = numeri;
    else filter.none = true;
  }

  const hasCustomRange = Boolean(f.dataDa || f.dataA);
  if (hasCustomRange) {
    if (f.dataDa) filter.dataGte = dayStart(f.dataDa).toISOString();
    if (f.dataA) filter.dataLte = dayEnd(f.dataA).toISOString();
  } else if (f.mese || opts?.defaultMeseCorrente) {
    const { inizio, fine } = rangeMeseIncassi(f.mese);
    filter.dataGte = inizio.toISOString();
    filter.dataLte = fine.toISOString();
  }

  if (f.affidoDa) filter.dataAffidoGte = dayStart(f.affidoDa).toISOString();
  if (f.affidoA) filter.dataAffidoLte = dayEnd(f.affidoA).toISOString();
  if (f.scaricoDa) filter.dataScaricoRicevutaGte = dayStart(f.scaricoDa).toISOString();
  if (f.scaricoA) filter.dataScaricoRicevutaLte = dayEnd(f.scaricoA).toISOString();

  return filter;
}

export type RigaIncassoElenco = {
  id: string;
  praticaId: string;
  praticaNumero: string;
  data: string;
  importo: string;
  importoNum: number;
  metodo: string;
  modo: string;
  modoLabel: string;
  causale: string;
  ricevuta: string;
  operatore: string;
  mandante: string;
  perimetro: string;
  lotto: string;
  cliente: string;
  citta: string;
  cap: string;
  dataAffido: string;
  dataScarico: string;
};

function mapRow(raw: Record<string, unknown>): RigaIncassoElenco {
  const row = mapSqlRow(raw) as Record<string, unknown>;
  const pratica = (row.pratica || {}) as Record<string, unknown>;
  const mandante = (pratica.mandante || {}) as Record<string, unknown>;
  const debitore = (pratica.debitore || {}) as Record<string, unknown>;
  const user = (row.user || {}) as Record<string, unknown>;
  const lotto = String(pratica.numeroMandante || "").trim();
  const perimetriRaw = (mandante.perimetri as string | null) ?? null;
  const hit = resolvePerimetroPratica(perimetriRaw, lotto || null);
  const modo = normalizeModoIncasso(row.modo as string | null);
  const modoLabel =
    MODI_INCASSO_PROVV.find((m) => m.value === modo)?.label ?? modo;
  const nome = String(debitore.nome || "").trim();
  const cognome = String(debitore.cognome || "").trim();
  const importoNum = Number(row.importo) || 0;
  return {
    id: String(row.id),
    praticaId: String(row.praticaId || pratica.id || ""),
    praticaNumero: String(pratica.numero || "—"),
    data: row.data ? dataIt(new Date(row.data as string | Date)) : "—",
    importo: euro(importoNum),
    importoNum,
    metodo: metodoIncassoLabel(String(row.metodo || "")),
    modo,
    modoLabel,
    causale: String(row.causale || "").trim() || "—",
    ricevuta: String(row.fattura || "").trim() || "—",
    operatore: String(user.name || "—"),
    mandante: String(mandante.codice || "—"),
    perimetro: hit ? etichettaPerimetro(hit) || hit.nomeMandante : "—",
    lotto: lotto || "—",
    cliente: [cognome, nome].filter(Boolean).join(" ") || "—",
    citta: String(debitore.citta || "").trim() || "—",
    cap: String(debitore.cap || "").trim() || "—",
    dataAffido: pratica.dataAffido
      ? dataIt(new Date(pratica.dataAffido as string | Date))
      : "—",
    dataScarico: pratica.codiceScaricoAt
      ? dataIt(new Date(pratica.codiceScaricoAt as string | Date))
      : "—",
  };
}

export async function loadIncassiElenco(
  user: SessionUser,
  filtri: IncassiElencoFiltri,
  mandantiRaw: Array<{
    id: string;
    codice: string;
    ragioneSociale: string;
    perimetri: unknown;
  }>,
  skip: number,
  take: number
) {
  const mandanti = mandantiConPerimetriAffidi(mandantiRaw);
  const filter = buildIncassoFilterFromElenco(filtri, mandanti, {
    defaultMeseCorrente: !filtri.dataDa && !filtri.dataA,
  });
  filter.tenantId = user.tenantId;

  if (isConnectorProvider()) {
    const repo = createConnectorIncassiRepository(resolveTenantSlug(user));
    const result = await repo.list({
      tenantSlug: resolveTenantSlug(user),
      tenantId: user.tenantId,
      filter,
      skip,
      take,
      includeElenco: true,
    });
    return {
      rows: result.items.map((item) => mapRow(item as Record<string, unknown>)),
      total: result.total,
      mandanti,
      meseLabel: rangeMeseIncassi(filtri.mese).label,
      meseParam: filtri.mese || `${parseIncMeseParam(filtri.mese).year}-${String(parseIncMeseParam(filtri.mese).month + 1).padStart(2, "0")}`,
    };
  }

  const where = filterToPrismaWhere(filter, user.tenantId);
  const [total, items] = await Promise.all([
    prisma.incasso.count({ where }),
    prisma.incasso.findMany({
      where,
      orderBy: { data: "desc" },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true } },
        pratica: {
          select: {
            id: true,
            numero: true,
            numeroMandante: true,
            dataAffido: true,
            codiceScaricoAt: true,
            mandanteId: true,
            mandante: {
              select: { codice: true, ragioneSociale: true, perimetri: true },
            },
            debitore: {
              select: { nome: true, cognome: true, citta: true, cap: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    rows: items.map((item) => mapRow(item as unknown as Record<string, unknown>)),
    total,
    mandanti,
    meseLabel: rangeMeseIncassi(filtri.mese).label,
    meseParam:
      filtri.mese ||
      `${parseIncMeseParam(filtri.mese).year}-${String(parseIncMeseParam(filtri.mese).month + 1).padStart(2, "0")}`,
  };
}

function filterToPrismaWhere(
  filter: IncassoFilter,
  tenantId: string
): Prisma.IncassoWhereInput {
  if (filter.none) return { id: "__none__" };

  const pratica: Prisma.PraticaWhereInput = { tenantId };
  if (filter.mandanteId) pratica.mandanteId = filter.mandanteId;
  if (filter.numeroMandante) pratica.numeroMandante = filter.numeroMandante;
  if (filter.numeriMandanteIn?.length) {
    pratica.numeroMandante = { in: filter.numeriMandanteIn };
  }
  if (filter.dataAffidoGte || filter.dataAffidoLte) {
    pratica.dataAffido = {};
    if (filter.dataAffidoGte) pratica.dataAffido.gte = new Date(filter.dataAffidoGte);
    if (filter.dataAffidoLte) pratica.dataAffido.lte = new Date(filter.dataAffidoLte);
  }
  if (filter.dataScaricoRicevutaGte || filter.dataScaricoRicevutaLte) {
    pratica.codiceScaricoAt = {};
    if (filter.dataScaricoRicevutaGte) {
      pratica.codiceScaricoAt.gte = new Date(filter.dataScaricoRicevutaGte);
    }
    if (filter.dataScaricoRicevutaLte) {
      pratica.codiceScaricoAt.lte = new Date(filter.dataScaricoRicevutaLte);
    }
  }
  if (filter.cittaContains || filter.clienteContains || filter.capDa || filter.capA) {
    const debitore: Prisma.DebitoreWhereInput = {};
    if (filter.cittaContains) {
      debitore.citta = { contains: filter.cittaContains };
    }
    if (filter.clienteContains) {
      debitore.OR = [
        { nome: { contains: filter.clienteContains } },
        { cognome: { contains: filter.clienteContains } },
      ];
    }
    if (filter.capDa || filter.capA) {
      debitore.cap = {};
      if (filter.capDa) debitore.cap.gte = filter.capDa;
      if (filter.capA) debitore.cap.lte = filter.capA;
    }
    pratica.debitore = debitore;
  }

  const where: Prisma.IncassoWhereInput = { pratica };
  if (filter.userId) where.userId = filter.userId;
  if (filter.metodo) where.metodo = filter.metodo;
  if (filter.modo) where.modo = filter.modo;
  if (filter.causaleContains) {
    where.causale = { contains: filter.causaleContains };
  }
  if (filter.fatturaContains) {
    where.fattura = { contains: filter.fatturaContains };
  }
  if (filter.dataGte || filter.dataLte) {
    where.data = {};
    if (filter.dataGte) where.data.gte = new Date(filter.dataGte);
    if (filter.dataLte) where.data.lte = new Date(filter.dataLte);
  }
  return where;
}
