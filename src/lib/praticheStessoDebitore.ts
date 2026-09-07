import { praticaDb, type PraticaDbContext } from "@/lib/praticheRepo";
import {
  normalizeCf,
  praticaIdsCollegatePerCf,
} from "@/lib/domain";
import {
  isPraticaF9Collegata,
  isPraticaF10Collegata,
} from "@/lib/praticaCollegata";
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
  const ref = { mandante: hit.mandante };
  return {
    corrente: hit,
    altre: others.filter((v) =>
      isPraticaF9Collegata({ ...v, mandante: v.mandante }, ref)
    ),
    altreChiuse: others.filter((v) =>
      isPraticaF10Collegata({ ...v, mandante: v.mandante }, ref)
    ),
  };
}

export type PraticaCollegataVoce = {
  id: string;
  numero: string;
  nome: string;
  cf: string | null;
  stato: string;
  assegnatarioId: string | null;
  codiceScarico: string | null;
  codiceScaricoBk: string | null;
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

/** Connector/JSON può restituire Date o stringa ISO. */
function toIsoDate(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapVoce(
  p: {
    id: string;
    numero: string;
    stato: string;
    assegnatarioId?: string | null;
    codiceScarico?: string | null;
    codiceScaricoBk?: string | null;
    residuo: number;
    nettoDaPagare?: number | null;
    rateArretrate?: number | null;
    scadenza: Date | string | null;
    updatedAt: Date | string;
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
    assegnatarioId: p.assegnatarioId ?? null,
    codiceScarico: p.codiceScarico?.trim() || null,
    codiceScaricoBk: p.codiceScaricoBk?.trim() || null,
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
    scadenza: toIsoDate(p.scadenza),
    updatedAt: toIsoDate(p.updatedAt) || new Date(0).toISOString(),
    accessibile: true,
  };
}

const CACHE_NS = "praticheCollegateV5";

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
    CACHE_NS,
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

  const correnteRef = {
    mandanteId: pratica.mandanteId,
    mandante: pratica.mandante.codice,
  };

  const altreRows = rows.filter((p) =>
    isPraticaF9Collegata(
      {
        stato: p.stato,
        assegnatarioId: p.assegnatarioId,
        scadenza: p.scadenza,
        codiceScaricoBk: p.codiceScaricoBk,
        mandanteId: p.mandanteId,
        mandante: p.mandante.codice,
      },
      correnteRef
    )
  );
  const f10Rows = rows.filter((p) =>
    isPraticaF10Collegata(
      {
        stato: p.stato,
        assegnatarioId: p.assegnatarioId,
        scadenza: p.scadenza,
        codiceScaricoBk: p.codiceScaricoBk,
        mandanteId: p.mandanteId,
        mandante: p.mandante.codice,
      },
      correnteRef
    )
  );

  const payload: PraticheStessoDebitorePayload = {
    corrente: mapVoce(pratica, cf),
    altre: altreRows.map((p) => mapVoce(p, cf)),
    altreChiuse: f10Rows.map((p) => mapVoce(p, cf)),
  };

  ttlSet(tenantId, CACHE_NS, payload, 60_000, praticaId);
  // Stesso cluster: cache anche per gli altri id (click tra collegate).
  for (const v of [...payload.altre, ...payload.altreChiuse]) {
    ttlSet(tenantId, CACHE_NS, payload, 60_000, v.id);
  }
  return payload;
}

/** Id navigazione F9/F10 dal payload già risolto (niente seconda scansione CF). */
export function collegataIdsFromPayload(
  payload: PraticheStessoDebitorePayload,
  filtro: "aperta" | "chiusa"
): string[] {
  const ref = { mandante: payload.corrente.mandante };
  const voci =
    filtro === "chiusa"
      ? [
          ...(isPraticaF10Collegata(
            { ...payload.corrente, mandante: payload.corrente.mandante },
            ref
          )
            ? [payload.corrente]
            : []),
          ...payload.altreChiuse,
        ]
      : [
          ...(isPraticaF9Collegata(
            { ...payload.corrente, mandante: payload.corrente.mandante },
            ref
          )
            ? [payload.corrente]
            : []),
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
