import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import {
  debitoreUpdateFromCsv,
  ImportPraticaIndex,
  parseCsvPraticaRow,
  praticaUpdateFromCsv,
  type ExistingPraticaImport,
} from "@/lib/importCsvPratiche";
import { IMPORT_PRATICHE_CHUNK_SIZE } from "@/lib/importCsvUtils";

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

async function nextNumeroPratica(tenantId: string) {
  const last = await prisma.pratica.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { numero: true },
  });
  const year = new Date().getFullYear();
  const match = last?.numero?.match(/(\d+)$/);
  const n = match ? Number(match[1]) + 1 : 1;
  return `PRC-${year}-${String(n).padStart(4, "0")}`;
}

export async function initPraticheImportBatch(input: {
  tenantId: string;
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
  const existing = await prisma.importBatch.findFirst({
    where: {
      tenantId: input.tenantId,
      tipo: "PRATICHE",
      mandanteId: input.mandanteId,
      perimetro: input.perimetro,
      lotto: input.lotto,
    },
    orderBy: { createdAt: "desc" },
  });

  const isIntegrazione = Boolean(existing);
  const batch =
    existing ??
    (await prisma.importBatch.create({
      data: {
        tenantId: input.tenantId,
        tipo: "PRATICHE",
        mandanteId: input.mandanteId,
        mandanteCodice: input.mandanteCodice,
        perimetro: input.perimetro,
        lotto: input.lotto,
        affidoIl: input.affidoIl,
        scadenzaMandato: input.scadenzaMandato ?? undefined,
        fileName: input.fileName,
        nPratiche: 0,
        createdById: input.userId,
        createdByName: input.userName,
      },
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

/** Cache indice integrazione tra chunk (stessa istanza serverless). */
const integrazioneIndexCache = new Map<string, ImportPraticaIndex>();

export function clearIntegrazioneIndexCache(batchId: string) {
  integrazioneIndexCache.delete(batchId);
}

export async function processPraticheImportChunk(input: {
  tenantId: string;
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
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let maxScadenza: Date | null = null;

  const existingPratiche: ExistingPraticaImport[] = [];
  let index: ImportPraticaIndex;
  if (ctx.isIntegrazione) {
    const cached = integrazioneIndexCache.get(ctx.batchId);
    if (cached) {
      index = cached;
    } else {
      const loaded = await prisma.pratica.findMany({
        where: { tenantId, importBatchId: ctx.batchId },
        select: {
          id: true,
          debitoreId: true,
          contratto: true,
          commessa: true,
          stato: true,
          codiceScarico: true,
          note: true,
          debitore: { select: { codiceFiscale: true } },
        },
      });
      index = new ImportPraticaIndex(loaded);
      integrazioneIndexCache.set(ctx.batchId, index);
    }
  } else {
    index = new ImportPraticaIndex(existingPratiche);
  }

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
      await prisma.debitore.update({
        where: { id: match.debitoreId },
        data: debitoreUpdateFromCsv(row),
      });
      await prisma.pratica.update({
        where: { id: match.id },
        data: praticaUpdateFromCsv(row, match),
      });
      updated += 1;
      continue;
    }

    const debitore = await prisma.debitore.create({
      data: {
        tenantId,
        nome: row.nome,
        cognome: row.cognome,
        codiceFiscale: row.cf,
        telefono: row.telefono,
        citta: row.citta,
        indirizzo: row.indirizzo,
        cap: row.cap,
        provincia: row.provincia,
      },
    });
    const pratica = await prisma.pratica.create({
      data: {
        tenantId,
        numero: await nextNumeroPratica(tenantId),
        mandanteId: ctx.mandanteId,
        debitoreId: debitore.id,
        numeroMandante: row.lottoRiga,
        contratto: row.contratto,
        commessa: row.commessa,
        dataAffido: ctx.affidoIl,
        scadenza: row.scadenza,
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

    if (ctx.isIntegrazione) {
      index.register(
        {
          id: pratica.id,
          debitoreId: debitore.id,
          contratto: row.contratto,
          commessa: row.commessa,
          stato: row.statoPratica,
          codiceScarico: null,
          note: null,
          debitore: { codiceFiscale: row.cf },
        },
        row
      );
    }
    created += 1;
  }

  return {
    created,
    updated,
    skipped,
    maxScadenza: maxScadenza?.toISOString() ?? null,
  };
}

export async function finalizePraticheImport(input: {
  tenantId: string;
  userId: string;
  ctx: PraticheImportContext;
  totals: { created: number; updated: number; skipped: number };
  maxScadenzaCsv: Date | null;
}) {
  const { ctx, totals, tenantId, userId } = input;
  const imported = totals.created + totals.updated;

  if (imported === 0) {
    if (!ctx.isIntegrazione) {
      await prisma.importBatch.delete({ where: { id: ctx.batchId } }).catch(() => undefined);
    }
    clearIntegrazioneIndexCache(ctx.batchId);
    return { imported: 0 };
  }

  const praticheBatch = await prisma.pratica.findMany({
    where: { tenantId, importBatchId: ctx.batchId },
    select: { id: true },
  });
  const totale = praticheBatch.length;

  const batch = await prisma.importBatch.findFirst({
    where: { id: ctx.batchId, tenantId },
    select: { scadenzaMandato: true },
  });

  const scadenzaToSave =
    ctx.scadenzaMandato ??
    input.maxScadenzaCsv ??
    batch?.scadenzaMandato ??
    null;

  await prisma.importBatch.update({
    where: { id: ctx.batchId },
    data: {
      nPratiche: totale,
      ...(ctx.fileName ? { fileName: ctx.fileName } : {}),
      ...(scadenzaToSave ? { scadenzaMandato: scadenzaToSave } : {}),
    },
  });

  clearIntegrazioneIndexCache(ctx.batchId);

  await writeAudit({
    userId,
    tenantId,
    action: ctx.isIntegrazione ? "import_integrazione" : "import",
    entity: "pratica",
    entityId: ctx.batchId,
    dettaglio: ctx.isIntegrazione
      ? `Integrazione +${totals.created} nuove · ${totals.updated} aggiornate · ${ctx.mandanteCodice} · perimetro ${ctx.perimetro} · lotto ${ctx.lotto}`
      : `${totals.created} pratiche · ${ctx.mandanteCodice} · perimetro ${ctx.perimetro} · lotto ${ctx.lotto}`,
  });

  return { imported: totale };
}

export { IMPORT_PRATICHE_CHUNK_SIZE } from "@/lib/importCsvUtils";
