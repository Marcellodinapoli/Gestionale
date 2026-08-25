import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operatorSigla } from "@/lib/noteFormat";
import type { GruppoLavoro } from "@/lib/gruppoLavoro";
import { gruppoLavoroPraticaWhere } from "@/lib/gruppoLavoro";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import type { PerimetroGruppoRef } from "@/lib/affidiPerimetro";
import {
  CODICI_SCARICO,
  codiceScaricoPratica,
  fmtPct,
  pctPezzi,
  pctSuAffidato,
  praticaAffidato,
} from "@/lib/scarico";

export {
  fmtImportoTabella,
  type StatisticheFiltri,
  type ScaricoColonna,
  type StatisticheRiga,
  type StatisticheSezione,
} from "@/lib/statisticheGruppoUi";

import type {
  ScaricoColonna,
  StatisticheRiga,
  StatisticheSezione,
  StatisticheFiltri,
} from "@/lib/statisticheGruppoUi";

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

export function parseLottiFiltro(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : raw.split(/[,;]+/);
  return [
    ...new Set(
      parts
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

export async function buildStatisticheGruppo(
  gruppo: GruppoLavoro,
  filtri: StatisticheFiltri,
  opts?: {
    tenantId?: string;
    tutteLePratiche?: boolean;
    /** Scope aggiuntivo (es. perimetri del gruppo). */
    extraWhere?: Prisma.PraticaWhereInput | null;
    /** Se true e non c’è extraWhere valido → nessuna pratica. */
    richiedePerimetriGruppo?: boolean;
  }
) {
  if (opts?.richiedePerimetriGruppo && !opts.extraWhere) {
    return { sezioni: [], totale: buildRiga("AGENZIA", "—", "—", [], true), praticheCount: 0 };
  }

  const scopeBase =
    opts?.tutteLePratiche && opts.tenantId
      ? { tenantId: opts.tenantId }
      : gruppoLavoroPraticaWhere(gruppo.memberIds);

  const scope: Prisma.PraticaWhereInput = opts?.extraWhere
    ? { AND: [scopeBase, opts.extraWhere] }
    : scopeBase;

  const lotti = (filtri.lotti || []).map((l) => l.trim()).filter(Boolean);

  const where: Prisma.PraticaWhereInput = {
    AND: [
      scope,
      { stato: { notIn: [...STATI_PRATICA_CHIUSA] } },
      ...(filtri.mandanteId ? [{ mandanteId: filtri.mandanteId }] : []),
      ...(lotti.length === 1
        ? [{ numeroMandante: lotti[0] }]
        : lotti.length > 1
          ? [{ numeroMandante: { in: lotti } }]
          : []),
      ...(filtri.affidoDa || filtri.affidoA
        ? [
            {
              dataAffido: {
                ...(filtri.affidoDa ? { gte: filtri.affidoDa } : {}),
                ...(filtri.affidoA ? { lte: filtri.affidoA } : {}),
              },
            },
          ]
        : []),
    ],
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

  const righePiatte = [...buckets.values()]
    .map((b) => buildRiga(b.esa, b.mandato, b.lottoCg, b.pratiche))
    .sort(
      (a, b) =>
        a.lottoCg.localeCompare(b.lottoCg, "it") ||
        a.esa.localeCompare(b.esa, "it") ||
        a.mandato.localeCompare(b.mandato, "it")
    );

  const byPerimetro = new Map<string, typeof pratiche>();
  for (const p of pratiche) {
    const peri = p.numeroMandante?.trim() || "—";
    if (!byPerimetro.has(peri)) byPerimetro.set(peri, []);
    byPerimetro.get(peri)!.push(p);
  }

  const sezioni: StatisticheSezione[] = [...byPerimetro.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "it"))
    .map(([perimetro, pratichePeri]) => {
      const righe = righePiatte.filter((r) => r.lottoCg === perimetro);
      const mandati = [...new Set(righe.map((r) => r.mandato))];
      const subtotale = buildRiga(
        "TOT.",
        mandati.length === 1 ? mandati[0]! : "—",
        perimetro,
        pratichePeri,
        true
      );
      return { perimetro, righe, subtotale };
    });

  const totale = buildRiga(
    "AGENZIA",
    filtri.mandanteId
      ? sezioni[0]?.righe[0]?.mandato || "—"
      : "Tutti",
    sezioni.length === 1 ? sezioni[0]!.perimetro : "Tutti",
    pratiche,
    true
  );

  return { sezioni, totale, praticheCount: pratiche.length };
}

/** Aggiunge sezioni vuote per i perimetri configurati sul gruppo senza pratiche nel periodo. */
export function completaSezioniPerimetriConfigurate(
  sezioni: StatisticheSezione[],
  perimetri: PerimetroGruppoRef[]
): StatisticheSezione[] {
  if (!perimetri.length) return sezioni;

  const byPerimetro = new Map(sezioni.map((s) => [s.perimetro, s]));
  for (const ref of perimetri) {
    if (byPerimetro.has(ref.perimetro)) continue;
    const subtotale = buildRiga("TOT.", ref.mandanteCodice, ref.perimetro, [], true);
    byPerimetro.set(ref.perimetro, {
      perimetro: ref.perimetro,
      righe: [],
      subtotale,
    });
  }

  return [...byPerimetro.values()].sort((a, b) =>
    a.perimetro.localeCompare(b.perimetro, "it", { numeric: true })
  );
}

export { fmtPct };
