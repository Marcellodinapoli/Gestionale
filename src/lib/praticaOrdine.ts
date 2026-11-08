import type { Prisma } from "@prisma/client";
import type { PraticaDbContext } from "@/lib/praticheRepo";
import type { SortDir, SortField } from "@/lib/praticaSortFields";

export type { SortDir, SortField } from "@/lib/praticaSortFields";
export {
  SORT_COLUMNS,
  isUltimaLavorazioneSort,
  parseDir,
  parseSort,
} from "@/lib/praticaSortFields";

/** Ruoli le cui attività contano come lavorazione (note, SMS, e-mail, telefonate, …). */
export const RUOLI_LAVORAZIONE = ["OPERATOR", "SUPERVISOR"] as const;

/**
 * Qualsiasi evento sul registro (nota, SMS, e-mail, telefonata, lettera, messaggio, …)
 * creato da Operatore o Supervisor.
 */
export const attivitaLavorazioneWhere: Prisma.AttivitaWhereInput = {
  user: { role: { in: [...RUOLI_LAVORAZIONE] } },
};

export function buildOrderBy(
  sort: SortField,
  dir: SortDir
): Prisma.PraticaOrderByWithRelationInput {
  switch (sort) {
    case "numero":
      return { numero: dir };
    case "debitore":
      return { debitore: { cognome: dir } };
    case "cap":
      return { debitore: { cap: dir } };
    case "citta":
      return { debitore: { citta: dir } };
    case "prov":
      return { debitore: { provincia: dir } };
    case "telefono":
      return { debitore: { telefono: dir } };
    case "dataAffido":
      return { dataAffido: dir };
    case "scadenza":
      return { scadenza: dir };
    case "scadenzaStragiud":
      return { dataPassaggioGiudiziale: dir };
    case "mandante":
      return { mandante: { codice: dir } };
    case "lotto":
      return { numeroMandante: dir };
    case "assegnatario":
      return { assegnatario: { name: dir } };
    case "codScarico":
      return { codiceScarico: dir };
    case "affidoProvv":
      return { operatoreTitolareId: dir };
    case "stato":
      return { stato: dir };
    case "esito":
      return { esitoContatto: dir };
    case "residuo":
      return { residuo: dir };
    case "importoRata":
      return { rate: { _count: dir } };
    case "rateScadute":
      return { rate: { _count: dir } };
    case "totIncassato":
      return { incassi: { _count: dir } };
    case "importoTot":
      return { nettoDaPagare: dir };
    case "cfPiva":
      return { debitore: { codiceFiscale: dir } };
    case "garante":
      return { garanti: { _count: dir } };
    case "ultimaLavorazione":
    case "ultimaLavorazioneOra":
      return { ultimaLavorazioneAt: dir };
    default:
      return { numero: dir };
  }
}

function sortDirFromPrisma(v: unknown): SortDir {
  return v === "asc" ? "asc" : "desc";
}

function normalizePrismaOrderBy(orderBy: unknown): Record<string, unknown> | null {
  if (Array.isArray(orderBy)) return normalizePrismaOrderBy(orderBy[0]);
  if (!orderBy || typeof orderBy !== "object") return null;
  return orderBy as Record<string, unknown>;
}

/** Inverso di `buildOrderBy` per elenco via Connector / Neon. */
export function prismaOrderByToSort(
  orderBy: unknown
): { field: SortField; dir: SortDir } | undefined {
  const ob = normalizePrismaOrderBy(orderBy);
  if (!ob) return undefined;

  if ("updatedAt" in ob) {
    return { field: "ultimaLavorazione", dir: sortDirFromPrisma(ob.updatedAt) };
  }
  if ("numero" in ob) return { field: "numero", dir: sortDirFromPrisma(ob.numero) };
  if ("ultimaLavorazioneAt" in ob) {
    return {
      field: "ultimaLavorazione",
      dir: sortDirFromPrisma(ob.ultimaLavorazioneAt),
    };
  }
  if ("dataAffido" in ob) return { field: "dataAffido", dir: sortDirFromPrisma(ob.dataAffido) };
  if ("scadenza" in ob) return { field: "scadenza", dir: sortDirFromPrisma(ob.scadenza) };
  if ("dataPassaggioGiudiziale" in ob) {
    return { field: "scadenzaStragiud", dir: sortDirFromPrisma(ob.dataPassaggioGiudiziale) };
  }
  if ("numeroMandante" in ob) return { field: "lotto", dir: sortDirFromPrisma(ob.numeroMandante) };
  if ("codiceScarico" in ob) return { field: "codScarico", dir: sortDirFromPrisma(ob.codiceScarico) };
  if ("operatoreTitolareId" in ob) {
    return { field: "affidoProvv", dir: sortDirFromPrisma(ob.operatoreTitolareId) };
  }
  if ("stato" in ob) return { field: "stato", dir: sortDirFromPrisma(ob.stato) };
  if ("esitoContatto" in ob) return { field: "esito", dir: sortDirFromPrisma(ob.esitoContatto) };
  if ("residuo" in ob) return { field: "residuo", dir: sortDirFromPrisma(ob.residuo) };
  if ("nettoDaPagare" in ob) {
    return { field: "importoTot", dir: sortDirFromPrisma(ob.nettoDaPagare) };
  }
  if ("capitale" in ob) return { field: "importoTot", dir: sortDirFromPrisma(ob.capitale) };

  if ("debitore" in ob && ob.debitore && typeof ob.debitore === "object") {
    const d = ob.debitore as Record<string, unknown>;
    if ("cognome" in d) return { field: "debitore", dir: sortDirFromPrisma(d.cognome) };
    if ("cap" in d) return { field: "cap", dir: sortDirFromPrisma(d.cap) };
    if ("citta" in d) return { field: "citta", dir: sortDirFromPrisma(d.citta) };
    if ("provincia" in d) return { field: "prov", dir: sortDirFromPrisma(d.provincia) };
    if ("telefono" in d) return { field: "telefono", dir: sortDirFromPrisma(d.telefono) };
    if ("codiceFiscale" in d) return { field: "cfPiva", dir: sortDirFromPrisma(d.codiceFiscale) };
  }
  if ("mandante" in ob && ob.mandante && typeof ob.mandante === "object") {
    const m = ob.mandante as Record<string, unknown>;
    if ("codice" in m) return { field: "mandante", dir: sortDirFromPrisma(m.codice) };
  }
  if ("assegnatario" in ob && ob.assegnatario && typeof ob.assegnatario === "object") {
    const a = ob.assegnatario as Record<string, unknown>;
    if ("name" in a) return { field: "assegnatario", dir: sortDirFromPrisma(a.name) };
  }
  if ("rate" in ob && ob.rate && typeof ob.rate === "object") {
    const r = ob.rate as Record<string, unknown>;
    if ("_count" in r) return { field: "importoRata", dir: sortDirFromPrisma(r._count) };
  }
  if ("incassi" in ob && ob.incassi && typeof ob.incassi === "object") {
    const i = ob.incassi as Record<string, unknown>;
    if ("_count" in i) return { field: "totIncassato", dir: sortDirFromPrisma(i._count) };
  }
  if ("garanti" in ob && ob.garanti && typeof ob.garanti === "object") {
    const g = ob.garanti as Record<string, unknown>;
    if ("_count" in g) return { field: "garante", dir: sortDirFromPrisma(g._count) };
  }

  return undefined;
}

/** ORDER BY SQL (Postgres / Neon) allineato a `buildOrderBy` e al Connector. */
export function neonPraticheOrderBySql(sort?: { field: SortField; dir: SortDir }): string {
  const dir = sort?.dir === "asc" ? "ASC" : "DESC";
  const nulls = "NULLS LAST";
  const tieNumero = `, p."Numero" ASC`;

  switch (sort?.field) {
    case "numero":
      return `p."Numero" ${dir} ${nulls}`;
    case "debitore":
      return `d."Cognome" ${dir} ${nulls}, d."Nome" ${dir} ${nulls}${tieNumero}`;
    case "cap":
      return `d."Cap" ${dir} ${nulls}${tieNumero}`;
    case "citta":
      return `d."Citta" ${dir} ${nulls}${tieNumero}`;
    case "prov":
      return `d."Provincia" ${dir} ${nulls}${tieNumero}`;
    case "telefono":
      return `d."Telefono" ${dir} ${nulls}${tieNumero}`;
    case "dataAffido":
      return `p."DataAffido" ${dir} ${nulls}${tieNumero}`;
    case "scadenza":
      return `p."Scadenza" ${dir} ${nulls}${tieNumero}`;
    case "scadenzaStragiud":
      return `p."DataPassaggioGiudiziale" ${dir} ${nulls}${tieNumero}`;
    case "mandante":
      return `m."Codice" ${dir} ${nulls}${tieNumero}`;
    case "lotto":
      return `p."NumeroMandante" ${dir} ${nulls}${tieNumero}`;
    case "assegnatario":
      return `a."Name" ${dir} ${nulls}${tieNumero}`;
    case "codScarico":
      return `p."CodiceScarico" ${dir} ${nulls}${tieNumero}`;
    case "affidoProvv":
      return `p."OperatoreTitolareId" ${dir} ${nulls}${tieNumero}`;
    case "stato":
      return `p."Stato" ${dir} ${nulls}${tieNumero}`;
    case "esito":
      return `p."EsitoContatto" ${dir} ${nulls}${tieNumero}`;
    case "residuo":
      return `p."Residuo" ${dir} ${nulls}${tieNumero}`;
    case "importoRata":
      return `p."ImportoRata" ${dir} ${nulls}${tieNumero}`;
    case "rateScadute":
      return `p."RateArretrate" ${dir} ${nulls}${tieNumero}`;
    case "totIncassato":
      return `p."TotIncassato" ${dir} ${nulls}${tieNumero}`;
    case "importoTot":
      return `(COALESCE(p."NettoDaPagare", p."Residuo") - COALESCE(p."TotIncassato", 0)) ${dir} ${nulls}${tieNumero}`;
    case "cfPiva":
      return `d."CodiceFiscale" ${dir} ${nulls}${tieNumero}`;
    case "garante":
      return `(SELECT COUNT(*)::int FROM "Garanti" g WHERE g."PraticaId" = p."Id") ${dir} ${nulls}${tieNumero}`;
    case "ultimaLavorazione":
    case "ultimaLavorazioneOra":
      return `p."UltimaLavorazioneAt" ${dir} ${nulls}${tieNumero}`;
    default:
      return `p."UltimaLavorazioneAt" ASC ${nulls}${tieNumero}`;
  }
}

/**
 * Fallback: IDs ordinati caricando tutte le pratiche + ultima attività.
 * Preferire `orderBy: { ultimaLavorazioneAt }` + skip/take su findMany quando possibile.
 * Esclude note di admin / back office / amministrazione (anche massiva).
 */
export async function orderPraticaIdsByUltimaLavorazione(
  where: Prisma.PraticaWhereInput,
  dir: SortDir,
  ctx: PraticaDbContext,
  skip = 0,
  take?: number
): Promise<string[]> {
  const { praticaDb } = await import("@/lib/praticheRepo");
  const praticaModel = praticaDb(ctx);
  const rows = await praticaModel.findMany({
    where,
    select: {
      id: true,
      numero: true,
      attivita: {
        where: attivitaLavorazioneWhere,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  rows.sort((a, b) => {
    const ta = a.attivita?.[0]?.createdAt?.getTime?.() ??
      (a.attivita?.[0]?.createdAt
        ? new Date(a.attivita[0].createdAt as string | Date).getTime()
        : undefined);
    const tb = b.attivita?.[0]?.createdAt?.getTime?.() ??
      (b.attivita?.[0]?.createdAt
        ? new Date(b.attivita[0].createdAt as string | Date).getTime()
        : undefined);
    const aNull = ta == null || Number.isNaN(ta);
    const bNull = tb == null || Number.isNaN(tb);
    if (aNull && bNull) return a.numero.localeCompare(b.numero, "it");
    if (aNull) return dir === "asc" ? -1 : 1;
    if (bNull) return dir === "asc" ? 1 : -1;
    const cmp = ta! - tb!;
    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    return a.numero.localeCompare(b.numero, "it");
  });

  const ids = rows.map((r) => r.id);
  if (take == null) return ids;
  return ids.slice(skip, skip + take);
}

export const ultimaLavorazioneInclude = {
  where: attivitaLavorazioneWhere,
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: { createdAt: true },
};
