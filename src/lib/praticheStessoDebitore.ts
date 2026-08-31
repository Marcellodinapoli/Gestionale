import { prisma } from "@/lib/prisma";
import { praticaDb, type PraticaDbContext } from "@/lib/praticheRepo";
import {
  normalizeCf,
  praticaIdsCollegatePerCf,
} from "@/lib/domain";
import { isPraticaChiusa } from "@/lib/praticaCollegata";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import { ttlGet, ttlSet } from "@/lib/firebase/ttlCache";

/** Adatta il payload cluster alla pratica corrente (cache condivisa tra collegate). */
export function payloadForPratica(
  payload: PraticheStessoDebitorePayload,
  praticaId: string
): PraticheStessoDebitorePayload {
  if (payload.corrente.id === praticaId) return payload;
  const all = [payload.corrente, ...payload.altre, ...payload.altreChiuse];
  const hit = all.find((v) => v.id === praticaId);
  if (!hit) return payload;
  const others = all.filter((v) => v.id !== praticaId);
  return {
    corrente: hit,
    altre: others.filter((v) => !isPraticaChiusa(v.stato)),
    altreChiuse: others.filter((v) => isPraticaChiusa(v.stato)),
  };
}

export type PraticaCollegataVoce = {
  id: string;
  numero: string;
  nome: string;
  cf: string | null;
  stato: string;
  codiceScarico: string | null;
  mandante: string;
  mandanteNome: string;
  /** Acronimo interno del perimetro (nomeInterno). */
  perimetro: string | null;
  residuo: number;
  /** Importo da incassare (netto da pagare se presente). */
  importoDaIncassare: number;
  rateInsolute: number | null;
  scadenza: string | null;
  updatedAt: string;
  accessibile: boolean;
};

export type PraticheStessoDebitorePayload = {
  corrente: PraticaCollegataVoce;
  altre: PraticaCollegataVoce[];
  altreChiuse: PraticaCollegataVoce[];
};

/** Risolve la chiave ImportBatch.perimetro → acronimo interno. */
function acronimoPerimetro(
  perimetriRaw: string | null | undefined,
  chiave: string | null | undefined
): string | null {
  const key = chiave?.trim();
  if (!key) return null;
  const elenco = parsePerimetri(perimetriRaw);
  if (!elenco.length) return key;
  const hit =
    elenco.find((p) => p.nomeMandante.trim() === key) ??
    elenco.find((p) => p.descrizione.trim() === key) ??
    elenco.find((p) => p.nomeInterno.trim() === key) ??
    null;
  const acronimo = hit?.nomeInterno?.trim();
  return acronimo || key;
}

function mapVoce(
  p: {
    id: string;
    numero: string;
    stato: string;
    codiceScarico?: string | null;
    residuo: number;
    nettoDaPagare?: number | null;
    rateArretrate?: number | null;
    scadenza: Date | null;
    updatedAt: Date;
    debitore: { cognome: string; nome: string; codiceFiscale?: string | null };
    mandante: {
      codice: string;
      ragioneSociale: string;
      perimetri?: string | null;
    };
    importBatch?: { perimetro: string } | null;
  },
  cf: string | null
): PraticaCollegataVoce {
  const netto =
    p.nettoDaPagare != null && Number.isFinite(p.nettoDaPagare)
      ? p.nettoDaPagare
      : p.residuo;
  return {
    id: p.id,
    numero: p.numero,
    nome: `${p.debitore.cognome} ${p.debitore.nome}`.trim(),
    cf,
    stato: p.stato,
    codiceScarico: p.codiceScarico?.trim() || null,
    mandante: p.mandante.codice,
    mandanteNome: p.mandante.ragioneSociale,
    perimetro: acronimoPerimetro(
      p.mandante.perimetri,
      p.importBatch?.perimetro
    ),
    residuo: p.residuo,
    importoDaIncassare: netto,
    rateInsolute:
      p.rateArretrate != null && Number.isFinite(p.rateArretrate)
        ? p.rateArretrate
        : null,
    scadenza: p.scadenza?.toISOString() || null,
    updatedAt: p.updatedAt.toISOString(),
    accessibile: true,
  };
}

/** Carica F9/F10 in un passaggio (niente doppio find della pratica corrente). */
export async function loadPraticheStessoDebitorePayload(
  tenantId: string,
  praticaId: string,
  tenantSlug?: string
): Promise<PraticheStessoDebitorePayload | null> {
  const ctx: PraticaDbContext = {
    tenantId,
    tenantSlug: tenantSlug ?? tenantId,
    role: "ADMIN",
    userId: tenantId,
  };
  const praticaModel = praticaDb(ctx);
  const cached = ttlGet<PraticheStessoDebitorePayload>(
    tenantId,
    "praticheCollegateV2",
    praticaId
  );
  if (cached) return payloadForPratica(cached, praticaId);

  const pratica = await praticaModel.findUnique({
    where: { id: praticaId },
    include: {
      debitore: true,
      mandante: true,
      importBatch: { select: { perimetro: true } },
      garanti: { select: { codiceFiscale: true } },
    },
  });
  if (!pratica || pratica.tenantId !== tenantId) return null;

  const cf = normalizeCf(pratica.debitore.codiceFiscale) || null;

  const linkedIds = await praticaIdsCollegatePerCf(pratica.id, {
    stessoMandante: false,
    tenantId: pratica.tenantId,
    tenantSlug: ctx.tenantSlug,
    seed: {
      id: pratica.id,
      tenantId: pratica.tenantId,
      mandanteId: pratica.mandanteId,
      debitore: { codiceFiscale: pratica.debitore.codiceFiscale },
      garanti: pratica.garanti,
    },
  });

  const fetchIds = linkedIds.filter((id) => id !== pratica.id);
  const rows = fetchIds.length
    ? await praticaModel.findMany({
        where: { id: { in: fetchIds } },
        include: {
          debitore: true,
          mandante: true,
          importBatch: { select: { perimetro: true } },
        },
        orderBy: { numero: "asc" },
      })
    : [];

  const payload: PraticheStessoDebitorePayload = {
    corrente: mapVoce(pratica, cf),
    altre: rows
      .filter(
        (p) => p.mandanteId === pratica.mandanteId && !isPraticaChiusa(p.stato)
      )
      .map((p) => mapVoce(p, cf)),
    altreChiuse: rows
      .filter((p) => isPraticaChiusa(p.stato))
      .map((p) => mapVoce(p, cf)),
  };

  ttlSet(tenantId, "praticheCollegateV2", payload, 60_000, praticaId);
  // Stesso cluster: cache anche per gli altri id (click tra collegate).
  for (const v of [...payload.altre, ...payload.altreChiuse]) {
    ttlSet(tenantId, "praticheCollegateV2", payload, 60_000, v.id);
  }
  return payload;
}

/** Id navigazione F9/F10 dal payload già risolto (niente seconda scansione CF). */
export function collegataIdsFromPayload(
  payload: PraticheStessoDebitorePayload,
  filtro: "aperta" | "chiusa"
): string[] {
  const voci =
    filtro === "chiusa"
      ? [
          ...(isPraticaChiusa(payload.corrente.stato) ? [payload.corrente] : []),
          ...payload.altreChiuse,
        ]
      : [
          ...(!isPraticaChiusa(payload.corrente.stato) ? [payload.corrente] : []),
          ...payload.altre,
        ];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const v of voci.sort((a, b) =>
    a.numero.localeCompare(b.numero, "it", { numeric: true })
  )) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    ids.push(v.id);
  }
  return ids;
}
