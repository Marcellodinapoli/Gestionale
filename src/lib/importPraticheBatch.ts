import "server-only";

import { praticaDb } from "@/lib/praticheRepo";
import { importBatchRepo } from "@/lib/importBatchRepo";
import { appendAudit } from "@/lib/auditRepo";
import { isConnectorProvider } from "@/lib/data/factory";
import {
  debitoreUpdateFromCsv,
  ImportPraticaIndex,
  parseCsvPraticaRow,
  praticaUpdateFromCsv,
} from "@/lib/importCsvPratiche";
import { IMPORT_PRATICHE_CHUNK_SIZE } from "@/lib/importCsvUtils";
import {
  importBatchPraticaSelectForIndex,
  importBatchPraticheWhere,
  toExistingPraticaImport,
} from "@/lib/importBatchPratiche";

export type PraticheImportContext = {
  batchId: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: Date;
  scadenzaMandato: Date | null;
  isIntegrazione: boolean;
  fileName: string | null;
};

/** Chunk HTTP: 500 righe con connector (1 tx SQL/chunk), 15 con firestore (timeout Netlify). */
export function importPraticheChunkSize(): number {
  return isConnectorProvider() ? 500 : IMPORT_PRATICHE_CHUNK_SIZE;
}

export async function initPraticheImportBatch(input: {
  tenantId: string;
  tenantSlug?: string;
  userId: string;
  userName: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: Date;
  scadenzaMandato: Date | null;
  fileName: string | null;
}): Promise<PraticheImportContext> {
  const slug = input.tenantSlug ?? input.tenantId;
  const repo = importBatchRepo({ tenantId: input.tenantId, tenantSlug: slug });
  const existing = await repo.findByLotKey(slug, input.tenantId, {
    mandanteId: input.mandanteId,
    perimetro: input.perimetro,
    lotto: input.lotto,
  });

  const isIntegrazione = Boolean(existing);
  const batch =
    existing ??
    (await repo.create(slug, input.tenantId, {
      tenantId: input.tenantId,
      tipo: "PRATICHE",
      mandanteId: input.mandanteId,
      mandanteCodice: input.mandanteCodice,
      perimetro: input.perimetro,
      lotto: input.lotto,
      affidoIl: input.affidoIl.toISOString(),
      scadenzaMandato: input.scadenzaMandato?.toISOString() ?? null,
      fileName: input.fileName,
      nPratiche: 0,
      createdById: input.userId,
      createdByName: input.userName,
    }));

  return {
    batchId: batch.id,
    mandanteId: input.mandanteId,
    mandanteCodice: input.mandanteCodice,
    perimetro: input.perimetro,
    lotto: input.lotto,
    affidoIl: input.affidoIl,
    scadenzaMandato: input.scadenzaMandato,
    isIntegrazione,
    fileName: input.fileName,
  };
}

const integrazioneIndexCache = new Map<string, ImportPraticaIndex>();

export function clearIntegrazioneIndexCache(batchId: string) {
  integrazioneIndexCache.delete(batchId);
}

export async function processPraticheImportChunk(input: {
  tenantId: string;
  tenantSlug?: string;
  ctx: PraticheImportContext;
  header: string[];
  delim: string;
  lines: string[];
}): Promise<{
  created: number;
  updated: number;
  skipped: number;
  maxScadenza: string | null;
}> {
  const { tenantId, ctx, header, delim, lines } = input;
  const slug = input.tenantSlug ?? tenantId;
  const dbCtx = { tenantId, tenantSlug: slug };
  const importRepo = importBatchRepo(dbCtx);
  let skipped = 0;
  let maxScadenza: Date | null = null;

  let index: ImportPraticaIndex;
  if (ctx.isIntegrazione) {
    const cached = integrazioneIndexCache.get(ctx.batchId);
    if (cached) {
      index = cached;
    } else {
      const praticaModel = praticaDb({ ...dbCtx, role: "ADMIN", userId: "" });
      const loaded = await praticaModel.findMany({
        where: importBatchPraticheWhere(tenantId, ctx),
        select: importBatchPraticaSelectForIndex,
      });
      index = new ImportPraticaIndex(loaded.map(toExistingPraticaImport));
      integrazioneIndexCache.set(ctx.batchId, index);
    }
  } else {
    index = new ImportPraticaIndex([]);
  }

  const creates: Parameters<typeof importRepo.processImportChunk>[2]["creates"] = [];
  const updates: Parameters<typeof importRepo.processImportChunk>[2]["updates"] = [];

  for (const line of lines) {
    const cols = line.split(delim);
    const row = parseCsvPraticaRow(cols, header, ctx.lotto);
    if (!row) {
      skipped += 1;
      continue;
    }

    if (row.scadenza && (!maxScadenza || row.scadenza.getTime() > maxScadenza.getTime())) {
      maxScadenza = row.scadenza;
    }

    const match = ctx.isIntegrazione ? index.find(row) : null;

    if (match) {
      updates.push({
        praticaId: match.id,
        debitoreId: match.debitoreId,
        debitore: debitoreUpdateFromCsv(row) as Record<string, unknown>,
        pratica: {
          ...praticaUpdateFromCsv(row, match),
          importBatchId: ctx.batchId,
        } as Record<string, unknown>,
      });
      continue;
    }

    creates.push({
      debitore: {
        nome: row.nome,
        cognome: row.cognome,
        codiceFiscale: row.cf,
        telefono: row.telefono,
        citta: row.citta,
        indirizzo: row.indirizzo,
        cap: row.cap,
        provincia: row.provincia,
      },
      pratica: {
        mandanteId: ctx.mandanteId,
        numeroMandante: row.lottoRiga,
        contratto: row.contratto,
        commessa: row.commessa,
        dataAffido: ctx.affidoIl.toISOString(),
        scadenza: row.scadenza?.toISOString() ?? null,
        capitale: row.capitale,
        interessi: row.interessi,
        spese: row.spese,
        speseRecupero: row.speseRecupero,
        residuo: row.residuo,
        importoRata: row.importoRata,
        rateArretrate: row.rateArretrate,
        nettoDaPagare: row.nettoDaPagare,
        stato: row.statoPratica,
        importBatchId: ctx.batchId,
      },
    });
  }

  const result = await importRepo.processImportChunk(slug, tenantId, { creates, updates });

  if (ctx.isIntegrazione && result.createdPratiche?.length) {
    for (const p of result.createdPratiche) {
      index.register(
        {
          id: p.id,
          debitoreId: p.debitoreId,
          contratto: p.contratto,
          commessa: p.commessa,
          stato: p.stato,
          codiceScarico: null,
          note: null,
          debitore: { codiceFiscale: p.codiceFiscale },
        },
        {
          contratto: p.contratto,
          commessa: p.commessa,
          cf: p.codiceFiscale,
        } as never
      );
    }
  }

  return {
    created: result.created,
    updated: result.updated,
    skipped,
    maxScadenza: maxScadenza?.toISOString() ?? null,
  };
}

export async function finalizePraticheImport(input: {
  tenantId: string;
  tenantSlug?: string;
  userId: string;
  ctx: PraticheImportContext;
  totals: { created: number; updated: number; skipped: number };
  maxScadenzaCsv: Date | null;
}) {
  const { ctx, totals, tenantId, userId } = input;
  const slug = input.tenantSlug ?? tenantId;
  const repo = importBatchRepo({ tenantId, tenantSlug: slug });
  const imported = totals.created + totals.updated;

  if (imported === 0) {
    if (!ctx.isIntegrazione) {
      await repo.delete(slug, tenantId, ctx.batchId).catch(() => undefined);
    }
    clearIntegrazioneIndexCache(ctx.batchId);
    return { imported: 0, totale: 0 };
  }

  const { totale } = await repo.linkPraticheToBatch(slug, tenantId, {
    batchId: ctx.batchId,
    mandanteId: ctx.mandanteId,
    lotto: ctx.lotto,
    affidoIl: ctx.affidoIl.toISOString(),
  });

  const batch = await repo.getById(slug, tenantId, ctx.batchId);
  const scadenzaToSave =
    ctx.scadenzaMandato ??
    input.maxScadenzaCsv ??
    (batch?.scadenzaMandato ? new Date(batch.scadenzaMandato) : null) ??
    null;

  await repo.update(slug, tenantId, ctx.batchId, {
    nPratiche: totale,
    ...(ctx.fileName ? { fileName: ctx.fileName } : {}),
    ...(scadenzaToSave ? { scadenzaMandato: scadenzaToSave.toISOString() } : {}),
  });

  clearIntegrazioneIndexCache(ctx.batchId);

  await appendAudit({
    userId,
    tenantId,
    tenantSlug: slug,
    action: ctx.isIntegrazione ? "import_integrazione" : "import",
    entity: "pratica",
    entityId: ctx.batchId,
    dettaglio: ctx.isIntegrazione
      ? `Integrazione +${totals.created} nuove · ${totals.updated} aggiornate · ${ctx.mandanteCodice} · perimetro ${ctx.perimetro} · lotto ${ctx.lotto}`
      : `${totals.created} pratiche · ${ctx.mandanteCodice} · perimetro ${ctx.perimetro} · lotto ${ctx.lotto}`,
  });

  return { imported: totale, totale };
}

export { IMPORT_PRATICHE_CHUNK_SIZE } from "@/lib/importCsvUtils";
