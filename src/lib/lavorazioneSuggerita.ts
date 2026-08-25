import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDataIso, startOfDay, startOfNextDay, formatDataIso } from "@/lib/lavorateOggi";
import { attivitaLavorazioneWhere } from "@/lib/praticaOrdine";
import {
  COLONNE_CODICI,
  type CodiceConteggioKey,
  type RigaCodiciMandantePerimetro,
} from "@/lib/codiciMandantePerimetro";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import {
  CODICI_SCARICO,
  codiceScaricoPratica,
  isCodiceScarico,
  type CodiceScarico,
} from "@/lib/scarico";
import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";
import {
  altriFiltriWhere,
  appendAltriFiltriParams,
  hasAltriFiltri,
  idsAffidoTemporaneo,
  idsImportoTotale,
  idsTotIncassato,
  parseAltriFiltri,
  sanitizeAltriFiltri,
} from "@/lib/praticheAltriFiltri";
import { buildPraticheQuery } from "@/components/PaginazioneBar";

export {
  STATO_LAVORAZIONE_FISSO,
  emptyVoce,
  CODICI_SCARICO_VOCE,
  matchPerimetroRiga,
  situazioneRigaVoce,
  applyPerimetroRiga,
  clearPerimetroRiga,
  codiciScaricoPerRiga,
  labelPerimetroVoce,
  type VoceLavorazioneSuggerita,
  type OperatoreConteggiLavorazione,
  type VoceLavorazioneConConteggi,
  type PerimetroRigaLavorazione,
} from "@/lib/lavorazioneSuggeritaUi";
import {
  STATO_LAVORAZIONE_FISSO,
  emptyVoce,
  CODICI_SCARICO_VOCE,
  clearPerimetroRiga,
  type VoceLavorazioneSuggerita,
  type OperatoreConteggiLavorazione,
  type VoceLavorazioneConConteggi,
  type PerimetroRigaLavorazione,
} from "@/lib/lavorazioneSuggeritaUi";

function newId() {
  return `lav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseVoceFiltri(o: Record<string, unknown>): AltriFiltri {
  if (o.filtri && typeof o.filtri === "object") {
    return sanitizeAltriFiltri(o.filtri);
  }
  const legacy: Record<string, string> = {};
  const dataLavDa = String(o.dataLavDa || o.dataLavorazione || "").trim();
  const dataLavA = String(o.dataLavA || o.dataLavorazione || dataLavDa).trim();
  const promPagDa = String(o.promPagDa || "").trim();
  const promPagA = String(o.promPagA || "").trim();
  if (dataLavDa) legacy.affidoDa = dataLavDa;
  if (dataLavA) legacy.affidoA = dataLavA;
  if (promPagDa) legacy.promPagDa = promPagDa;
  if (promPagA) legacy.promPagA = promPagA;
  return parseAltriFiltri(legacy) ?? {};
}

function parseLavorateFields(o: Record<string, unknown>, fallback: string) {
  const lavorateDa = String(o.lavorateDa || o.dataLavDa || o.dataLavorazione || fallback).trim() || fallback;
  const lavorateA =
    String(o.lavorateA || o.dataLavA || o.dataLavorazione || lavorateDa).trim() || lavorateDa;
  return { lavorateDa, lavorateA };
}

export function defaultVociLavorazione(): VoceLavorazioneSuggerita[] {
  return [
    { ...emptyVoce("Promesse di pagamento in scadenza"), codiceScarico: "PPC" },
    emptyVoce("Pratiche in lavorazione da contattare"),
    emptyVoce("Nuovi affidamenti del giorno"),
  ];
}

export function parseLavorazioneSuggerita(
  raw: string | null | undefined
): VoceLavorazioneSuggerita[] {
  const oggi = formatDataIso(new Date());
  return getPiano(parseLavorazioneStore(raw), oggi).voci;
}

export function serializeLavorazioneSuggerita(voci: VoceLavorazioneSuggerita[]): string {
  return JSON.stringify(voci);
}

export type PianoLavorazione = {
  /** Giorno previsto per la lavorazione (ISO yyyy-mm-dd). */
  data: string;
  voci: VoceLavorazioneSuggerita[];
  /** Ultimo salvataggio: le lavorate si contano da questo momento. */
  salvatoAt?: string;
};

export type LavorazioneStore = {
  piani: PianoLavorazione[];
};

function parseVoceItem(item: unknown, dataPiano?: string): VoceLavorazioneSuggerita | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = String(o.id || "").trim() || newId();
  const cod = String(o.codiceScarico || "").trim();
  const fallback = dataPiano && parseDataIso(dataPiano) ? dataPiano : formatDataIso(new Date());
  const { lavorateDa, lavorateA } = parseLavorateFields(o, fallback);
  return {
    id,
    descrizione: String(o.descrizione || "").trim(),
    codiceScarico: isCodiceScarico(cod) ? cod : "",
    filtri: parseVoceFiltri(o),
    lavorateDa,
    lavorateA,
    note: String(o.note || "").trim(),
    noteAggiuntive: String(o.noteAggiuntive || "").trim(),
    contestoPerimetro:
      o.contestoPerimetro === "affido" || o.contestoPerimetro === "lavorazione"
        ? o.contestoPerimetro
        : undefined,
  };
}

function parseVociArray(arr: unknown[], dataPiano?: string): VoceLavorazioneSuggerita[] {
  const voci = arr
    .map((item) => parseVoceItem(item, dataPiano))
    .filter((x): x is VoceLavorazioneSuggerita => x != null);
  return voci.length ? voci : defaultVociPerGiorno(dataPiano || formatDataIso(new Date()));
}

export function defaultVociPerGiorno(data: string): VoceLavorazioneSuggerita[] {
  return defaultVociLavorazione().map((v) => ({
    ...v,
    lavorateDa: data,
    lavorateA: data,
  }));
}

function normalizePiano(item: unknown): PianoLavorazione | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const data = String(o.data || "").trim();
  if (!parseDataIso(data)) return null;
  const rawVoci = o.voci;
  const voci = Array.isArray(rawVoci) ? parseVociArray(rawVoci, data) : defaultVociPerGiorno(data);
  return {
    data,
    voci: voci.map((v) => ({
      ...v,
      lavorateDa: v.lavorateDa || data,
      lavorateA: v.lavorateA || data,
    })),
    salvatoAt: typeof o.salvatoAt === "string" ? o.salvatoAt : undefined,
  };
}

/** Store completo: più piani per giorni diversi. */
export function parseLavorazioneStore(raw: string | null | undefined): LavorazioneStore {
  if (!raw) return { piani: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as LavorazioneStore).piani)) {
      const piani = (parsed as LavorazioneStore).piani
        .map(normalizePiano)
        .filter((p): p is PianoLavorazione => p != null);
      return { piani };
    }
    if (Array.isArray(parsed)) {
      if (parsed.length && parsed[0] && typeof parsed[0] === "object" && "data" in (parsed[0] as object)) {
        const piani = parsed.map(normalizePiano).filter((p): p is PianoLavorazione => p != null);
        if (piani.length) return { piani };
      }
      const oggi = formatDataIso(new Date());
      const first = parsed[0] as Record<string, unknown> | undefined;
      const data =
        String(first?.dataLavorazione || first?.dataLavDa || "").trim() || oggi;
      return { piani: [{ data, voci: parseVociArray(parsed, data) }] };
    }
  } catch {
    /* formato legacy non valido */
  }
  return { piani: [] };
}

export function serializeLavorazioneStore(store: LavorazioneStore): string {
  return JSON.stringify(store);
}

export function elencoDatePiano(store: LavorazioneStore): string[] {
  return [...new Set(store.piani.map((p) => p.data))].sort((a, b) => a.localeCompare(b));
}

export function getPiano(store: LavorazioneStore, data: string): PianoLavorazione {
  const found = store.piani.find((p) => p.data === data);
  if (found) return found;
  return { data, voci: defaultVociPerGiorno(data) };
}

export function upsertPiano(
  store: LavorazioneStore,
  data: string,
  voci: VoceLavorazioneSuggerita[],
  opts?: { salvatoAt?: string }
): LavorazioneStore {
  const piani = store.piani.filter((p) => p.data !== data);
  piani.push({ data, voci, salvatoAt: opts?.salvatoAt });
  piani.sort((a, b) => a.data.localeCompare(b.data));
  return { piani };
}

export function removePiano(store: LavorazioneStore, data: string): LavorazioneStore {
  return { piani: store.piani.filter((p) => p.data !== data) };
}

export async function loadLavorazioneStore(supervisorId: string, tenantId: string) {
  const row = await loadSupervisorLavorazione(supervisorId, tenantId);
  if (!row) return { store: { piani: [] } as LavorazioneStore, supervisor: null };
  return {
    store: parseLavorazioneStore(row.lavorazioneSuggerita),
    supervisor: row,
  };
}

export async function saveLavorazioneStore(supervisorId: string, store: LavorazioneStore) {
  await saveSupervisorLavorazione(supervisorId, serializeLavorazioneStore(store));
}

/** Lettura/scrittura piano lavorazione sul campo User.lavorazioneSuggerita. */
export async function loadSupervisorLavorazione(supervisorId: string, tenantId: string) {
  const row = await prisma.user.findFirst({
    where: { id: supervisorId, tenantId },
    select: { lavorazioneSuggerita: true, name: true, gruppoNome: true },
  });
  return row ?? null;
}

export async function saveSupervisorLavorazione(supervisorId: string, json: string) {
  await prisma.user.update({
    where: { id: supervisorId },
    data: { lavorazioneSuggerita: json },
  });
}

function voceFiltriEffectivi(voce: VoceLavorazioneSuggerita): AltriFiltri {
  const filtri = { ...voce.filtri };
  if (voce.codiceScarico && !filtri.codScarico) filtri.codScarico = voce.codiceScarico;
  return filtri;
}

function mergeVoceHrefParams(
  voce: VoceLavorazioneSuggerita,
  dataPiano: string,
  opts?: { lavorate?: boolean; operatoreId?: string }
): Record<string, string> {
  const params: Record<string, string> = { stato: STATO_LAVORAZIONE_FISSO };
  const sp = new URLSearchParams();
  appendAltriFiltriParams(sp, voceFiltriEffectivi(voce));
  sp.forEach((v, k) => {
    params[k] = v;
  });
  if (opts?.lavorate) {
    if (dataPiano) {
      params.lavorateDa = dataPiano;
      params.lavorateA = dataPiano;
    }
  }
  if (opts?.operatoreId) params.operatore = opts.operatoreId;
  return params;
}

export async function buildVocePraticaWhere(
  voce: VoceLavorazioneSuggerita,
  tenantId: string
): Promise<Prisma.PraticaWhereInput> {
  const and: Prisma.PraticaWhereInput[] = [{ stato: STATO_LAVORAZIONE_FISSO }];

  if (voce.codiceScarico) {
    and.push({ codiceScarico: voce.codiceScarico });
  }

  const filtri = voce.filtri;
  if (hasAltriFiltri(filtri)) {
    const needTemp =
      filtri.sitAffido === "temporanea" || filtri.affidoProvvisorio === "1";
    const needImportoTot = !!(filtri.importoTotDa || filtri.importoTotA);
    const needTotInc = !!(filtri.totIncassatoDa || filtri.totIncassatoA);
    const [temporaneaIds, importoTotIds, totIncassatoIds] = await Promise.all([
      needTemp ? idsAffidoTemporaneo(tenantId) : Promise.resolve(undefined),
      needImportoTot
        ? idsImportoTotale(tenantId, filtri.importoTotDa, filtri.importoTotA)
        : Promise.resolve(undefined),
      needTotInc
        ? idsTotIncassato(tenantId, filtri.totIncassatoDa, filtri.totIncassatoA)
        : Promise.resolve(undefined),
    ]);
    and.push(
      altriFiltriWhere(filtri, {
        canFilterOperatore: true,
        temporaneaIds,
        importoTotIds: importoTotIds ?? undefined,
        totIncassatoIds: totIncassatoIds ?? undefined,
      })
    );
  }

  return and.length === 1 ? and[0]! : { AND: and };
}

/** @deprecated usa buildVocePraticaWhere */
export function vocePraticaWhere(voce: VoceLavorazioneSuggerita): Prisma.PraticaWhereInput {
  const and: Prisma.PraticaWhereInput[] = [{ stato: STATO_LAVORAZIONE_FISSO }];
  if (voce.codiceScarico) and.push({ codiceScarico: voce.codiceScarico });
  return and.length === 1 ? and[0]! : { AND: and };
}

export function voceToPraticheHrefTotale(
  voce: VoceLavorazioneSuggerita,
  dataPiano: string,
  operatoreId?: string
) {
  const params = mergeVoceHrefParams(voce, dataPiano, { operatoreId });
  const qs = buildPraticheQuery(params);
  return qs ? `/pratiche?${qs}` : "/pratiche";
}

export function voceToPraticheHrefLavorate(
  voce: VoceLavorazioneSuggerita,
  dataPiano: string,
  operatoreId?: string
) {
  const params = mergeVoceHrefParams(voce, dataPiano, { lavorate: true, operatoreId });
  const qs = buildPraticheQuery(params);
  return qs ? `/pratiche?${qs}` : "/pratiche";
}

/** @deprecated usa voceToPraticheHrefTotale */
export function voceToPraticheHref(voce: VoceLavorazioneSuggerita, operatoreId?: string) {
  return voceToPraticheHrefTotale(voce, formatDataIso(new Date()), operatoreId);
}

function intervalloLavorazione(dataPiano: string, salvatoAt?: string) {
  const giorno = parseDataIso(dataPiano) ?? startOfDay(new Date());
  const fineGiorno = startOfNextDay(giorno);
  if (salvatoAt) {
    const daSalvataggio = new Date(salvatoAt);
    if (!Number.isNaN(daSalvataggio.getTime())) {
      return {
        gte: daSalvataggio > fineGiorno ? startOfDay(giorno) : daSalvataggio,
        lt: fineGiorno,
      };
    }
  }
  return {
    gte: startOfDay(giorno),
    lt: fineGiorno,
  };
}

export async function conteggiVoceLavorazione(
  voce: VoceLavorazioneSuggerita,
  opts: {
    scope: Prisma.PraticaWhereInput;
    memberIds: string[];
    tenantId: string;
    dataPiano: string;
    salvatoAt?: string;
    operatoreId?: string;
  }
): Promise<{ totale: number; lavorate: number }> {
  const voceWhere = await buildVocePraticaWhere(voce, opts.tenantId);
  const memberFilter: Prisma.PraticaWhereInput = opts.operatoreId
    ? {
        OR: [
          { assegnatarioId: opts.operatoreId },
          { operatoreTitolareId: opts.operatoreId },
        ],
      }
    : {
        OR: [
          { assegnatarioId: { in: opts.memberIds } },
          { operatoreTitolareId: { in: opts.memberIds } },
        ],
      };

  const where: Prisma.PraticaWhereInput = {
    AND: [opts.scope, voceWhere, memberFilter],
  };

  const totale = await prisma.pratica.count({ where });

  const intervallo = intervalloLavorazione(opts.dataPiano, opts.salvatoAt);

  const lavorate = await prisma.pratica.count({
    where: {
      AND: [
        where,
        {
          attivita: {
            some: {
              ...attivitaLavorazioneWhere,
              createdAt: intervallo,
              ...(opts.operatoreId
                ? { userId: opts.operatoreId }
                : { userId: { in: opts.memberIds } }),
            },
          },
        },
      ],
    },
  });

  return { totale, lavorate };
}

export async function conteggiLavorazioneSuggerita(
  voci: VoceLavorazioneSuggerita[],
  opts: {
    scope: Prisma.PraticaWhereInput;
    memberIds: string[];
    tenantId: string;
    dataPiano: string;
    salvatoAt?: string;
    operatoreId?: string;
    operatori?: Array<{ id: string; name: string }>;
  }
): Promise<VoceLavorazioneConConteggi[]> {
  const out: VoceLavorazioneConConteggi[] = [];
  for (const voce of voci) {
    const { totale, lavorate } = await conteggiVoceLavorazione(voce, opts);
    const operatori: OperatoreConteggiLavorazione[] = [];

    if (opts.operatori?.length && !opts.operatoreId) {
      for (const op of opts.operatori) {
        const c = await conteggiVoceLavorazione(voce, { ...opts, operatoreId: op.id });
        operatori.push({
          id: op.id,
          name: op.name,
          totale: c.totale,
          lavorate: c.lavorate,
          hrefTotale: voceToPraticheHrefTotale(voce, opts.dataPiano, op.id),
          hrefLavorate: voceToPraticheHrefLavorate(voce, opts.dataPiano, op.id),
        });
      }
    }

    out.push({
      ...voce,
      totale,
      lavorate,
      hrefTotale: voceToPraticheHrefTotale(voce, opts.dataPiano, opts.operatoreId),
      hrefLavorate: voceToPraticheHrefLavorate(voce, opts.dataPiano, opts.operatoreId),
      operatori,
    });
  }
  return out;
}

export function voceToAltriFiltri(voce: VoceLavorazioneSuggerita): AltriFiltri {
  return voceFiltriEffectivi(voce);
}

export function mostraPromoPag(_voce: VoceLavorazioneSuggerita) {
  return false;
}

function chiavePerimetroCodice(mandanteId: string, perimetro: string, codice: CodiceConteggioKey) {
  return `${mandanteId}|${perimetro}|${codice}`;
}

function labelPerimetro(r: Pick<RigaCodiciMandantePerimetro, "mandanteCodice" | "perimetro">) {
  return r.perimetro === "—" ? r.mandanteCodice : `${r.mandanteCodice} · ${r.perimetro}`;
}

function codiceSlotToVoce(codice: CodiceConteggioKey): CodiceScarico | "" {
  return codice === "ND" ? "" : codice;
}

function sortPerimetriRiga(rows: PerimetroRigaLavorazione[]): PerimetroRigaLavorazione[] {
  return [...rows].sort((a, b) => {
    const s = a.situazione.localeCompare(b.situazione, "it");
    if (s !== 0) return s;
    const m = a.mandanteCodice.localeCompare(b.mandanteCodice, "it");
    if (m !== 0) return m;
    if (a.perimetro === "—" && b.perimetro !== "—") return 1;
    if (b.perimetro === "—" && a.perimetro !== "—") return -1;
    return a.perimetro.localeCompare(b.perimetro, "it", { numeric: true });
  });
}

/** Conteggi pratiche affidate per mandante · perimetro · codice scarico. */
export async function conteggiAffidatePerCodicePerimetro(
  scope: Prisma.PraticaWhereInput
): Promise<Map<string, number>> {
  const pratiche = await prisma.pratica.findMany({
    where: {
      AND: [
        scope,
        { assegnatarioId: { not: null } },
        { stato: { notIn: [...STATI_PRATICA_CHIUSA] } },
      ],
    },
    select: {
      mandanteId: true,
      numeroMandante: true,
      stato: true,
      codiceScarico: true,
    },
  });

  const map = new Map<string, number>();
  for (const p of pratiche) {
    const perimetro = p.numeroMandante?.trim() || "—";
    const slot: CodiceConteggioKey = codiceScaricoPratica(p.stato, p.codiceScarico) ?? "ND";
    const key = chiavePerimetroCodice(p.mandanteId, perimetro, slot);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function buildPerimetriRigaLavorazione(
  righe: RigaCodiciMandantePerimetro[],
  affidatePerCodice: Map<string, number>
): PerimetroRigaLavorazione[] {
  const byKey = new Map<string, PerimetroRigaLavorazione>();

  function ensure(
    situazione: PerimetroRigaLavorazione["situazione"],
    r: RigaCodiciMandantePerimetro
  ) {
    const prefix = situazione === "affido" ? "aff" : "lav";
    const key = `${prefix}|${r.mandanteId}|${r.perimetro}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        key,
        situazione,
        mandanteId: r.mandanteId,
        mandanteCodice: r.mandanteCodice,
        perimetro: r.perimetro,
        label: labelPerimetro(r),
        codici: [],
      };
      byKey.set(key, row);
    }
    return row;
  }

  for (const r of righe) {
    for (const col of COLONNE_CODICI) {
      const n = r.conteggi[col.key];
      if (n <= 0) continue;
      ensure("lavorazione", r).codici.push({
        codice: codiceSlotToVoce(col.key),
        count: n,
      });
    }

    for (const col of COLONNE_CODICI) {
      const key = chiavePerimetroCodice(r.mandanteId, r.perimetro, col.key);
      const n = affidatePerCodice.get(key) ?? 0;
      if (n <= 0) continue;
      ensure("affido", r).codici.push({
        codice: codiceSlotToVoce(col.key),
        count: n,
      });
    }
  }

  return sortPerimetriRiga([...byKey.values()]);
}

/**
 * Garantisce voci perimetro anche senza pratiche (solo anagrafica mandante/gruppo),
 * così in modifica piano la colonna Perimetro resta utilizzabile.
 */
export function mergePerimetriRigaConConfig(
  existing: PerimetroRigaLavorazione[],
  config: Array<{ mandanteId: string; mandanteCodice: string; perimetro: string }>
): PerimetroRigaLavorazione[] {
  if (!config.length) return existing;
  const byKey = new Map(existing.map((e) => [e.key, e]));

  for (const c of config) {
    const perimetro = c.perimetro.trim() || "—";
    for (const situazione of ["affido", "lavorazione"] as const) {
      const prefix = situazione === "affido" ? "aff" : "lav";
      const key = `${prefix}|${c.mandanteId}|${perimetro}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        key,
        situazione,
        mandanteId: c.mandanteId,
        mandanteCodice: c.mandanteCodice,
        perimetro,
        label: labelPerimetro({ mandanteCodice: c.mandanteCodice, perimetro }),
        codici: [],
      });
    }
  }

  return sortPerimetriRiga([...byKey.values()]);
}

export function applySituazioneRiga(
  voce: VoceLavorazioneSuggerita,
  situazione: "affido" | "lavorazione" | ""
): VoceLavorazioneSuggerita {
  if (!situazione) return clearPerimetroRiga(voce);
  const filtri = { ...voce.filtri };
  delete filtri.mandato;
  delete filtri.lotto;
  delete filtri.codScarico;
  if (situazione === "affido") filtri.sitAffido = "affidata";
  else delete filtri.sitAffido;
  return { ...voce, codiceScarico: "", filtri, contestoPerimetro: situazione };
}
