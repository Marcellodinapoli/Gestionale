import type { Prisma } from "@prisma/client";
import { usersDb } from "@/lib/usersRepo";
import { praticaDb, type PraticaDbContext } from "@/lib/praticheRepo";
import { parseDataIso, startOfDay, startOfNextDay, formatDataIso } from "@/lib/lavorateOggi";
import { attivitaLavorazioneWhere } from "@/lib/praticaOrdine";
import {
  COLONNE_CODICI,
  type CodiceConteggioKey,
  type RigaCodiciMandantePerimetro,
} from "@/lib/codiciMandantePerimetro";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import {
  codiceScaricoPratica,
  descrizioneDaCodiceScaricoVoce,
  parseCodiceScaricoVoce,
  whereSenzaCodiceScaricoPratica,
  type CodiceScaricoVoce,
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
  return [emptyVoce()];
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
  const codiceScarico = parseCodiceScaricoVoce(cod);
  const descrizioneRaw = String(o.descrizione || "").trim();
  return {
    id,
    descrizione: descrizioneRaw || descrizioneDaCodiceScaricoVoce(codiceScarico),
    codiceScarico,
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

export async function saveLavorazioneStore(supervisorId: string, store: LavorazioneStore, tenantId: string) {
  await saveSupervisorLavorazione(supervisorId, serializeLavorazioneStore(store), tenantId);
}

/** Lettura/scrittura piano lavorazione sul campo User.lavorazioneSuggerita. */
export async function loadSupervisorLavorazione(supervisorId: string, tenantId: string) {
  const userModel = usersDb({ tenantId, tenantSlug: tenantId });
  const row = await userModel.findFirst({
    where: { id: supervisorId, tenantId },
    select: { lavorazioneSuggerita: true, name: true, gruppoNome: true },
  });
  return row ?? null;
}

export async function saveSupervisorLavorazione(supervisorId: string, json: string, tenantId: string) {
  await usersDb({ tenantId, tenantSlug: tenantId }).update({
    where: { id: supervisorId },
    data: { lavorazioneSuggerita: json },
  });
}

function voceFiltriEffectivi(voce: VoceLavorazioneSuggerita): AltriFiltri {
  const filtri = { ...voce.filtri };
  if (voce.codiceScarico && voce.codiceScarico !== "ND" && !filtri.codScarico) {
    filtri.codScarico = voce.codiceScarico;
  }
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
  ctx: import("@/lib/praticheRepo").PraticaDbContext
): Promise<Prisma.PraticaWhereInput> {
  const and: Prisma.PraticaWhereInput[] = [{ stato: STATO_LAVORAZIONE_FISSO }];

  if (voce.codiceScarico === "ND") {
    and.push(whereSenzaCodiceScaricoPratica());
  } else if (voce.codiceScarico) {
    and.push({ codiceScarico: voce.codiceScarico });
  }

  const filtri = voce.filtri;
  if (hasAltriFiltri(filtri)) {
    const needTemp =
      filtri.sitAffido === "temporanea" || filtri.affidoProvvisorio === "1";
    const needImportoTot = !!(filtri.importoTotDa || filtri.importoTotA);
    const needTotInc = !!(filtri.totIncassatoDa || filtri.totIncassatoA);
    const [temporaneaIds, importoTotIds, totIncassatoIds] = await Promise.all([
      needTemp ? idsAffidoTemporaneo(ctx) : Promise.resolve(undefined),
      needImportoTot
        ? idsImportoTotale(ctx, filtri.importoTotDa, filtri.importoTotA)
        : Promise.resolve(undefined),
      needTotInc
        ? idsTotIncassato(ctx, filtri.totIncassatoDa, filtri.totIncassatoA)
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
  if (voce.codiceScarico === "ND") and.push(whereSenzaCodiceScaricoPratica());
  else if (voce.codiceScarico) and.push({ codiceScarico: voce.codiceScarico });
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
    tenantSlug: string;
    dataPiano: string;
    salvatoAt?: string;
    operatoreId?: string;
    /** Totale pratiche del filtro voce, senza vincolo assegnatario (colonna «Tot. pratiche»). */
    totaleSoloFiltro?: boolean;
  }
): Promise<{ totale: number; lavorate: number }> {
  const voceWhere = await buildVocePraticaWhere(voce, {
    tenantId: opts.tenantId,
    tenantSlug: opts.tenantSlug,
    role: "ADMIN",
    userId: opts.tenantId,
  });
  const baseWhere: Prisma.PraticaWhereInput = {
    AND: [opts.scope, voceWhere],
  };
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

  const whereTotale: Prisma.PraticaWhereInput =
    opts.operatoreId != null
      ? { AND: [baseWhere, memberFilter] }
      : opts.totaleSoloFiltro
        ? baseWhere
        : { AND: [baseWhere, memberFilter] };

  const praticaModel = praticaDb({
    tenantId: opts.tenantId,
    tenantSlug: opts.tenantSlug,
    role: "ADMIN",
    userId: opts.tenantId,
  });

  const totale = await praticaModel.count({ where: whereTotale });

  const intervallo = intervalloLavorazione(opts.dataPiano, opts.salvatoAt);
  const whereLavorateBase =
    opts.operatoreId != null || opts.totaleSoloFiltro ? baseWhere : whereTotale;

  const lavorate = await praticaModel.count({
    where: {
      AND: [
        whereLavorateBase,
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
    tenantSlug: string;
    dataPiano: string;
    salvatoAt?: string;
    operatoreId?: string;
    operatori?: Array<{ id: string; name: string }>;
  }
): Promise<VoceLavorazioneConConteggi[]> {
  const out: VoceLavorazioneConConteggi[] = [];
  for (const voce of voci) {
    const { totale, lavorate } = await conteggiVoceLavorazione(voce, {
      ...opts,
      totaleSoloFiltro: !opts.operatoreId,
    });
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

function resolveAcronimoPerimetro(
  perimetroKey: string,
  elenco: Array<{
    nomeInterno: string;
    nomeMandante: string;
    descrizione?: string;
  }>
): string | null {
  const key = perimetroKey.trim();
  if (!key || key === "—") return null;
  const hit =
    elenco.find((p) => p.nomeInterno.trim() === key) ??
    elenco.find((p) => p.nomeMandante.trim() === key) ??
    elenco.find((p) => (p.descrizione || "").trim() === key) ??
    null;
  return hit?.nomeInterno?.trim() || null;
}

function labelConAcronimo(
  mandanteCodice: string,
  perimetro: string,
  acronimo?: string | null
) {
  const peri = acronimo?.trim() || perimetro;
  return peri === "—" ? mandanteCodice : `${mandanteCodice} · ${peri}`;
}

/** Etichetta perimetro con lotto quando serve a distinguere omonimi (es. IFI · MO · 1426001). */
export function labelPerimetroRigaLavorazione(
  mandanteCodice: string,
  perimetro: string,
  acronimo?: string | null
) {
  const lotto = perimetro.trim();
  const acr = acronimo?.trim() || "";
  if (lotto && lotto !== "—" && acr && lotto !== acr) {
    return `${mandanteCodice} · ${acr} · ${lotto}`;
  }
  return labelConAcronimo(mandanteCodice, perimetro, acronimo);
}

function labelPerimetro(
  r: Pick<RigaCodiciMandantePerimetro, "mandanteId" | "mandanteCodice" | "perimetro">,
  elenco?: Array<{
    nomeInterno: string;
    nomeMandante: string;
    descrizione?: string;
  }>,
  /** Chiave `${mandanteId}|${lotto}` → perimetro ImportBatch. */
  lottoPerimetroByKey?: Map<string, string>
) {
  const viaLotto = lottoPerimetroByKey?.get(
    `${r.mandanteId}|${r.perimetro.trim()}`
  );
  const chiave = viaLotto || r.perimetro;
  const acronimo = elenco ? resolveAcronimoPerimetro(chiave, elenco) : null;
  return labelPerimetroRigaLavorazione(r.mandanteCodice, r.perimetro, acronimo);
}

function codiceSlotToVoce(codice: CodiceConteggioKey): CodiceScaricoVoce {
  return codice === "ND" ? "ND" : codice;
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
  scope: Prisma.PraticaWhereInput,
  ctx: PraticaDbContext
): Promise<Map<string, number>> {
  const praticaModel = praticaDb(ctx);
  const pratiche = await praticaModel.findMany({
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
  affidatePerCodice: Map<string, number>,
  perimetriByMandante?: Map<
    string,
    Array<{ nomeInterno: string; nomeMandante: string; descrizione?: string }>
  >,
  /** Chiave `${mandanteId}|${lotto}` → descrizione/perimetro ImportBatch. */
  lottoPerimetroByKey?: Map<string, string>
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
        label: labelPerimetro(
          r,
          perimetriByMandante?.get(r.mandanteId),
          lottoPerimetroByKey
        ),
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
 * Elenco perimetro in lavorazione: solo voci configurate su Affidi/gruppo (es. Riattivazioni),
 * non un'opzione per ogni lotto presente nei dati.
 */
export function perimetriRigaSoloConfigurazione(
  config: Array<{
    mandanteId: string;
    mandanteCodice: string;
    perimetro: string;
    acronimo?: string;
    perimetroLabel?: string;
  }>,
  daDati: PerimetroRigaLavorazione[],
  perimetriByMandante?: Map<
    string,
    Array<{ nomeInterno: string; nomeMandante: string; descrizione?: string }>
  >,
  lottoPerimetroByKey?: Map<string, string>
): PerimetroRigaLavorazione[] {
  if (!config.length) {
    return sortPerimetriRiga(daDati.filter((p) => p.situazione === "lavorazione"));
  }

  const byKey = new Map<string, PerimetroRigaLavorazione>();

  for (const c of config) {
    const perimetro = c.perimetro.trim() || "—";
    const elenco = perimetriByMandante?.get(c.mandanteId);
    const acronimo =
      c.acronimo?.trim() ||
      (elenco ? resolveAcronimoPerimetro(perimetro, elenco) : null);
    const key = `lav|${c.mandanteId}|${perimetro}`;
    byKey.set(key, {
      key,
      situazione: "lavorazione",
      mandanteId: c.mandanteId,
      mandanteCodice: c.mandanteCodice,
      perimetro,
      label:
        c.perimetroLabel?.trim() ||
        labelPerimetroRigaLavorazione(c.mandanteCodice, perimetro, acronimo),
      codici: [],
    });
  }

  for (const row of daDati) {
    if (row.situazione !== "lavorazione") continue;
    const configPerimetro = resolveConfigPerimetroPerDati(
      row,
      config,
      perimetriByMandante,
      lottoPerimetroByKey
    );
    if (!configPerimetro) continue;
    const key = `lav|${row.mandanteId}|${configPerimetro}`;
    const target = byKey.get(key);
    if (!target) continue;
    for (const cod of row.codici) {
      const existing = target.codici.find((x) => x.codice === cod.codice);
      if (existing) existing.count += cod.count;
      else target.codici.push({ ...cod });
    }
  }

  return sortPerimetriRiga([...byKey.values()]);
}

function resolveConfigPerimetroPerDati(
  row: PerimetroRigaLavorazione,
  config: Array<{
    mandanteId: string;
    perimetro: string;
    acronimo?: string;
    perimetroLabel?: string;
  }>,
  perimetriByMandante?: Map<
    string,
    Array<{ nomeInterno: string; nomeMandante: string; descrizione?: string }>
  >,
  lottoPerimetroByKey?: Map<string, string>
): string | null {
  const lotto = row.perimetro.trim();
  const direct = config.find(
    (c) => c.mandanteId === row.mandanteId && c.perimetro.trim() === lotto
  );
  if (direct) return direct.perimetro.trim();

  const batchPeri = lottoPerimetroByKey?.get(`${row.mandanteId}|${lotto}`)?.trim();
  if (batchPeri) {
    const byBatch = config.find(
      (c) =>
        c.mandanteId === row.mandanteId &&
        (c.perimetro.trim() === batchPeri ||
          c.acronimo?.trim() === batchPeri ||
          c.perimetroLabel?.toLowerCase().includes(batchPeri.toLowerCase()))
    );
    if (byBatch) return byBatch.perimetro.trim();
  }

  const elenco = perimetriByMandante?.get(row.mandanteId);
  if (elenco) {
    const chiave = batchPeri || lotto;
    const acr = resolveAcronimoPerimetro(chiave, elenco);
    if (acr) {
      const byAcr = config.find(
        (c) => c.mandanteId === row.mandanteId && c.acronimo?.trim() === acr
      );
      if (byAcr) return byAcr.perimetro.trim();
    }
  }

  return null;
}

/**
 * Garantisce voci perimetro anche senza pratiche (solo anagrafica mandante/gruppo),
 * così in modifica piano la colonna Perimetro resta utilizzabile.
 * @deprecated preferire perimetriRigaSoloConfigurazione
 */
export function mergePerimetriRigaConConfig(
  existing: PerimetroRigaLavorazione[],
  config: Array<{
    mandanteId: string;
    mandanteCodice: string;
    perimetro: string;
    /** Acronimo interno (nomeInterno). */
    acronimo?: string;
  }>,
  perimetriByMandante?: Map<
    string,
    Array<{ nomeInterno: string; nomeMandante: string; descrizione?: string }>
  >
): PerimetroRigaLavorazione[] {
  if (!config.length) return existing;
  const byKey = new Map(existing.map((e) => [e.key, e]));

  for (const c of config) {
    const perimetro = c.perimetro.trim() || "—";
    const elenco = perimetriByMandante?.get(c.mandanteId);
    const acronimo =
      c.acronimo?.trim() ||
      (elenco ? resolveAcronimoPerimetro(perimetro, elenco) : null);
    const situazioni: PerimetroRigaLavorazione["situazione"][] = ["lavorazione"];
    const affKey = `aff|${c.mandanteId}|${perimetro}`;
    if (byKey.has(affKey)) situazioni.unshift("affido");

    for (const situazione of situazioni) {
      const prefix = situazione === "affido" ? "aff" : "lav";
      const key = `${prefix}|${c.mandanteId}|${perimetro}`;
      const prev = byKey.get(key);
      if (prev) {
        byKey.set(key, {
          ...prev,
          label: labelPerimetroRigaLavorazione(c.mandanteCodice, perimetro, acronimo),
        });
        continue;
      }
      byKey.set(key, {
        key,
        situazione,
        mandanteId: c.mandanteId,
        mandanteCodice: c.mandanteCodice,
        perimetro,
        label: labelPerimetroRigaLavorazione(c.mandanteCodice, perimetro, acronimo),
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
