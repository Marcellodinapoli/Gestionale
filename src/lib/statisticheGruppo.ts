import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operatorSigla } from "@/lib/noteFormat";
import type { GruppoLavoro } from "@/lib/gruppoLavoro";
import { gruppoLavoroPraticaWhere } from "@/lib/gruppoLavoro";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import type { PerimetroGruppoRef } from "@/lib/affidiPerimetro";
import { acronimoPerimetroChiave, codiciScaricoPerAcronimo } from "@/lib/mandantePerimetri";
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

function defaultCodiciScarico(): string[] {
  return [...CODICI_SCARICO];
}

function emptyScarichi(codiciScarico: string[]): ScaricoColonna[] {
  return codiciScarico.map((codice) => ({
    codice,
    importo: 0,
    nr: 0,
    pctPz: 0,
  }));
}

function codiceScaricoStatistica(stato: string, codiceScarico?: string | null): string {
  const raw = codiceScarico?.trim().toUpperCase();
  if (raw) return raw;
  return codiceScaricoPratica(stato, codiceScarico ?? null) ?? "N/D";
}

function mergeCodiciScarico(...liste: string[][]): string[] {
  return [...new Set(liste.flat())].sort();
}

function allineaScarichiRiga(riga: StatisticheRiga, codiciScarico: string[]): StatisticheRiga {
  const scarichi = emptyScarichi(codiciScarico);
  for (const col of riga.scarichi) {
    const hit = scarichi.find((s) => s.codice === col.codice);
    if (hit) {
      hit.importo = col.importo;
      hit.nr = col.nr;
      hit.pctPz = col.pctPz;
    }
  }
  return { ...riga, scarichi };
}

function codiciScaricoSezione(
  acronimoPerimetro: string,
  pratichePeri: Array<{
    stato: string;
    codiceScarico?: string | null;
    mandante: { perimetri: string | null };
  }>,
  mandantiConfig?: Array<{ perimetri: string | null }>
): string[] {
  const set = new Set<string>();

  for (const m of mandantiConfig ?? []) {
    for (const c of codiciScaricoPerAcronimo(m.perimetri, acronimoPerimetro)) {
      set.add(c);
    }
  }
  for (const p of pratichePeri) {
    for (const c of codiciScaricoPerAcronimo(p.mandante.perimetri, acronimoPerimetro)) {
      set.add(c);
    }
  }
  for (const p of pratichePeri) {
    const cod = codiceScaricoStatistica(p.stato, p.codiceScarico ?? null);
    if (cod !== "N/D") set.add(cod);
  }

  if (!set.size) defaultCodiciScarico().forEach((c) => set.add(c));
  return [...set].sort();
}

function buildRiga(
  esa: string,
  mandato: string,
  perimetro: string,
  lotto: string,
  pratiche: Array<{
    stato: string;
    codiceScarico?: string | null;
    capitale: number;
    interessi: number;
    spese: number;
    incassi: { importo: number }[];
  }>,
  codiciScarico: string[],
  isTotale?: boolean
): StatisticheRiga {
  let affidato = 0;
  let incassato = 0;
  let nrPzInc = 0;
  let movimentate = 0;
  const scarichi = emptyScarichi(codiciScarico);

  for (const p of pratiche) {
    const aff = praticaAffidato(p.capitale, p.interessi, p.spese);
    affidato += aff;
    const inc = p.incassi.reduce((s, i) => s + i.importo, 0);
    incassato += inc;
    const incassata = inc > 0.009 || p.stato === "INCASSO";
    const codice = codiceScaricoStatistica(p.stato, p.codiceScarico ?? null);
    const col = scarichi.find((s) => s.codice === codice);

    if (col && inc > 0.009) {
      col.importo += inc;
    }
    if (incassata) {
      nrPzInc += 1;
      movimentate += 1;
      if (col) col.nr += 1;
    }
  }

  for (const col of scarichi) {
    col.pctPz = pctPezzi(col.nr, pratiche.length);
  }

  return {
    esa,
    mandato,
    perimetro,
    lotto,
    nrPrt: pratiche.length,
    affidato,
    incassato,
    nrPzInc,
    pctPzIncAffidato: pctSuAffidato(incassato, affidato),
    pctPzIncPezzi: pctPezzi(nrPzInc, pratiche.length),
    movimentate,
    scarichi,
    isTotale,
  };
}

function rigaKey(
  assegnatarioId: string | null,
  mandanteId: string,
  perimetro: string,
  lotto: string
) {
  return `${assegnatarioId || "none"}|${mandanteId}|${perimetro}|${lotto}`;
}

function perimetroLottoPratica(
  p: {
    mandanteId: string;
    numeroMandante: string | null;
    mandante: { perimetri: string | null };
    importBatch?: { perimetro: string; lotto: string } | null;
  },
  lottoPerimetroByKey: Map<string, string>
) {
  const lotto = p.numeroMandante?.trim() || p.importBatch?.lotto?.trim() || "—";
  const chiave =
    p.importBatch?.perimetro?.trim() ||
    lottoPerimetroByKey.get(`${p.mandanteId}|${lotto}`) ||
    null;
  const perimetro = acronimoPerimetroChiave(p.mandante.perimetri, chiave);
  return { perimetro, lotto };
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
    /** Mandanti del gruppo/tenant: codici scarico aggiornati anche senza pratiche nel periodo. */
    mandantiPerimetri?: Array<{ perimetri: string | null }>;
  }
) {
  if (opts?.richiedePerimetriGruppo && !opts.extraWhere) {
    return {
      sezioni: [],
      totale: buildRiga("AGENZIA", "—", "—", "—", [], defaultCodiciScarico(), true),
      praticheCount: 0,
    };
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
      mandante: { select: { codice: true, perimetri: true } },
      importBatch: { select: { perimetro: true, lotto: true } },
      assegnatario: { select: { id: true, name: true } },
      incassi: { select: { importo: true } },
    },
    orderBy: [{ assegnatarioId: "asc" }, { numero: "asc" }],
  });

  const tenantId = opts?.tenantId ?? pratiche[0]?.tenantId;

  const importBatches = tenantId
    ? await prisma.importBatch.findMany({
        where: { tenantId },
        select: { mandanteId: true, lotto: true, perimetro: true },
      })
    : [];

  const lottoPerimetroByKey = new Map(
    importBatches
      .filter((b) => b.lotto.trim() && b.perimetro.trim())
      .map((b) => [`${b.mandanteId}|${b.lotto.trim()}`, b.perimetro.trim()] as const)
  );

  const buckets = new Map<
    string,
    {
      esa: string;
      mandato: string;
      perimetro: string;
      lotto: string;
      pratiche: typeof pratiche;
    }
  >();

  for (const p of pratiche) {
    const { perimetro, lotto } = perimetroLottoPratica(p, lottoPerimetroByKey);
    const key = rigaKey(p.assegnatarioId, p.mandanteId, perimetro, lotto);
    if (!buckets.has(key)) {
      buckets.set(key, {
        esa: p.assegnatario ? operatorSigla(p.assegnatario.name) : "—",
        mandato: p.mandante.codice,
        perimetro,
        lotto,
        pratiche: [],
      });
    }
    buckets.get(key)!.pratiche.push(p);
  }

  const byPerimetro = new Map<string, typeof pratiche>();
  for (const p of pratiche) {
    const { perimetro } = perimetroLottoPratica(p, lottoPerimetroByKey);
    if (!byPerimetro.has(perimetro)) byPerimetro.set(perimetro, []);
    byPerimetro.get(perimetro)!.push(p);
  }

  const codiciByPerimetro = new Map<string, string[]>();
  for (const [perimetro, pratichePeri] of byPerimetro) {
    codiciByPerimetro.set(
      perimetro,
      codiciScaricoSezione(perimetro, pratichePeri, opts?.mandantiPerimetri)
    );
  }

  const righePiatte = [...buckets.values()]
    .map((b) =>
      buildRiga(
        b.esa,
        b.mandato,
        b.perimetro,
        b.lotto,
        b.pratiche,
        codiciByPerimetro.get(b.perimetro) ?? defaultCodiciScarico()
      )
    )
    .sort(
      (a, b) =>
        a.perimetro.localeCompare(b.perimetro, "it", { sensitivity: "base" }) ||
        a.lotto.localeCompare(b.lotto, "it", { numeric: true }) ||
        a.esa.localeCompare(b.esa, "it") ||
        a.mandato.localeCompare(b.mandato, "it")
    );

  const sezioni: StatisticheSezione[] = [...byPerimetro.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "it", { sensitivity: "base" }))
    .map(([perimetro, pratichePeri]) => {
      const codiciScarico = codiciByPerimetro.get(perimetro) ?? defaultCodiciScarico();
      const righe = righePiatte.filter((r) => r.perimetro === perimetro);
      const mandati = [...new Set(righe.map((r) => r.mandato))];
      const subtotale = buildRiga(
        "TOT.",
        mandati.length === 1 ? mandati[0]! : "—",
        perimetro,
        "—",
        pratichePeri,
        codiciScarico,
        true
      );
      return { perimetro, codiciScarico, righe, subtotale };
    });

  const codiciTotale = [
    ...new Set([...codiciByPerimetro.values()].flat()),
  ].sort();
  const totale = buildRiga(
    "AGENZIA",
    filtri.mandanteId ? sezioni[0]?.righe[0]?.mandato || "—" : "Tutti",
    sezioni.length === 1 ? sezioni[0]!.perimetro : "Tutti",
    sezioni.length === 1 ? sezioni[0]!.righe[0]?.lotto || "—" : "—",
    pratiche,
    codiciTotale.length ? codiciTotale : defaultCodiciScarico(),
    true
  );

  return { sezioni, totale, praticheCount: pratiche.length };
}

/** Aggiunge sezioni vuote per i perimetri configurati sul gruppo senza pratiche nel periodo. */
export function completaSezioniPerimetriConfigurate(
  sezioni: StatisticheSezione[],
  perimetri: PerimetroGruppoRef[],
  mandantiRaw?: Array<{ id: string; perimetri: string | null }>
): StatisticheSezione[] {
  if (!perimetri.length) return sezioni;

  const byPerimetro = new Map(sezioni.map((s) => [s.perimetro, s]));

  const codiciConfigPerAcronimo = (acronimo: string) =>
    mergeCodiciScarico(
      ...perimetri
        .filter((ref) => (ref.acronimo?.trim() || ref.perimetro) === acronimo)
        .map((ref) =>
          codiciScaricoPerAcronimo(
            mandantiRaw?.find((m) => m.id === ref.mandanteId)?.perimetri,
            acronimo
          )
        )
    );

  for (const ref of perimetri) {
    const acronimo = ref.acronimo?.trim() || ref.perimetro;
    const codiciConfig = codiciConfigPerAcronimo(acronimo);
    const codici = codiciConfig.length ? codiciConfig : defaultCodiciScarico();

    const existing = byPerimetro.get(acronimo);
    if (existing) {
      const merged = mergeCodiciScarico(existing.codiciScarico, codici);
      if (merged.join("|") !== existing.codiciScarico.join("|")) {
        byPerimetro.set(acronimo, {
          ...existing,
          codiciScarico: merged,
          righe: existing.righe.map((r) => allineaScarichiRiga(r, merged)),
          subtotale: allineaScarichiRiga(existing.subtotale, merged),
        });
      }
      continue;
    }

    const subtotale = buildRiga("TOT.", ref.mandanteCodice, acronimo, "—", [], codici, true);
    byPerimetro.set(acronimo, {
      perimetro: acronimo,
      codiciScarico: codici,
      righe: [],
      subtotale,
    });
  }

  return [...byPerimetro.values()].sort((a, b) =>
    a.perimetro.localeCompare(b.perimetro, "it", { numeric: true })
  );
}

/** Allinea colonne codici scarico del totale agenzia dopo merge sezioni. */
export function allineaTotaleStatistiche(
  sezioni: StatisticheSezione[],
  totale: StatisticheRiga
): StatisticheRiga {
  const codici = mergeCodiciScarico(...sezioni.map((s) => s.codiciScarico));
  return allineaScarichiRiga(totale, codici.length ? codici : defaultCodiciScarico());
}

export { fmtPct };
