import { prisma } from "@/lib/prisma";
import { importoIt } from "@/lib/domain";
import { operatorSigla } from "@/lib/noteFormat";
import type { GruppoLavoro } from "@/lib/gruppoLavoro";
import { gruppoLavoroPraticaWhere } from "@/lib/gruppoLavoro";
import {
  CODICI_SCARICO,
  codiceScaricoPratica,
  fmtPct,
  pctPezzi,
  pctSuAffidato,
  praticaAffidato,
  type CodiceScarico,
} from "@/lib/scarico";

export type StatisticheFiltri = {
  affidoDa?: Date;
  affidoA?: Date;
  mandanteId?: string;
  lotto?: string;
};

export type ScaricoColonna = {
  codice: CodiceScarico | "N/D";
  importo: number;
  nr: number;
  pctAffidato: number;
  pctPezzi: number;
};

export type StatisticheRiga = {
  esa: string;
  mandato: string;
  lottoCg: string;
  nrPrt: number;
  affidato: number;
  incassato: number;
  nrPzInc: number;
  pctPzIncAffidato: number;
  pctPzIncPezzi: number;
  scarichi: ScaricoColonna[];
  isTotale?: boolean;
};

function emptyScarichi(): ScaricoColonna[] {
  return [
    { codice: "N/D", importo: 0, nr: 0, pctAffidato: 0, pctPezzi: 0 },
    ...CODICI_SCARICO.map((codice) => ({
      codice,
      importo: 0,
      nr: 0,
      pctAffidato: 0,
      pctPezzi: 0,
    })),
  ];
}

function buildRiga(
  esa: string,
  mandato: string,
  lottoCg: string,
  pratiche: Array<{
    stato: string;
    codiceScarico?: string | null;
    capitale: number;
    interessi: number;
    spese: number;
    incassi: { importo: number }[];
  }>,
  isTotale?: boolean
): StatisticheRiga {
  let affidato = 0;
  let incassato = 0;
  let nrPzInc = 0;
  const scarichi = emptyScarichi();

  for (const p of pratiche) {
    const aff = praticaAffidato(p.capitale, p.interessi, p.spese);
    affidato += aff;
    const inc = p.incassi.reduce((s, i) => s + i.importo, 0);
    incassato += inc;
    if (inc > 0.009 || p.stato === "INCASSO") nrPzInc += 1;

    const codice = codiceScaricoPratica(p.stato, p.codiceScarico ?? null);
    const col = scarichi.find((s) => s.codice === (codice ?? "N/D"))!;
    col.importo += aff;
    col.nr += 1;
  }

  for (const col of scarichi) {
    col.pctAffidato = pctSuAffidato(col.importo, affidato);
    col.pctPezzi = pctPezzi(col.nr, pratiche.length);
  }

  return {
    esa,
    mandato,
    lottoCg,
    nrPrt: pratiche.length,
    affidato,
    incassato,
    nrPzInc,
    pctPzIncAffidato: pctSuAffidato(incassato, affidato),
    pctPzIncPezzi: pctPezzi(nrPzInc, pratiche.length),
    scarichi,
    isTotale,
  };
}

function rigaKey(
  assegnatarioId: string | null,
  mandanteId: string,
  lotto: string | null
) {
  return `${assegnatarioId || "none"}|${mandanteId}|${lotto || ""}`;
}

export async function buildStatisticheGruppo(
  gruppo: GruppoLavoro,
  filtri: StatisticheFiltri,
  opts?: { tenantId?: string; tutteLePratiche?: boolean }
) {
  const scope =
    opts?.tutteLePratiche && opts.tenantId
      ? { tenantId: opts.tenantId }
      : gruppoLavoroPraticaWhere(gruppo.memberIds);

  const where = {
    ...scope,
    ...(filtri.mandanteId ? { mandanteId: filtri.mandanteId } : {}),
    ...(filtri.lotto ? { numeroMandante: filtri.lotto } : {}),
    ...(filtri.affidoDa || filtri.affidoA
      ? {
          dataAffido: {
            ...(filtri.affidoDa ? { gte: filtri.affidoDa } : {}),
            ...(filtri.affidoA ? { lte: filtri.affidoA } : {}),
          },
        }
      : {}),
  };

  const pratiche = await prisma.pratica.findMany({
    where,
    include: {
      mandante: { select: { codice: true } },
      assegnatario: { select: { id: true, name: true } },
      incassi: { select: { importo: true } },
    },
    orderBy: [{ assegnatarioId: "asc" }, { numero: "asc" }],
  });

  const buckets = new Map<
    string,
    {
      esa: string;
      mandato: string;
      lottoCg: string;
      pratiche: typeof pratiche;
    }
  >();

  for (const p of pratiche) {
    const key = rigaKey(p.assegnatarioId, p.mandanteId, p.numeroMandante);
    if (!buckets.has(key)) {
      buckets.set(key, {
        esa: p.assegnatario ? operatorSigla(p.assegnatario.name) : "—",
        mandato: p.mandante.codice,
        lottoCg: p.numeroMandante || "—",
        pratiche: [],
      });
    }
    buckets.get(key)!.pratiche.push(p);
  }

  const righe = [...buckets.values()]
    .map((b) => buildRiga(b.esa, b.mandato, b.lottoCg, b.pratiche))
    .sort((a, b) => a.esa.localeCompare(b.esa) || a.mandato.localeCompare(b.mandato));

  const totale = buildRiga(
    "AGENZIA",
    filtri.mandanteId ? righe[0]?.mandato || "—" : "Tutti",
    filtri.lotto || "—",
    pratiche,
    true
  );

  return { righe, totale, praticheCount: pratiche.length };
}

export function fmtImportoTabella(value: number) {
  return importoIt(value);
}

export { fmtPct };
