"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import {
  praticaHaCambioCodice,
  praticaHaNote,
  type ImportBatchListItem,
} from "@/lib/importBatch";
import { importBatchPraticheWhere } from "@/lib/importBatchPratiche";

export async function listImportBatchPratiche(
  tenantId: string
): Promise<ImportBatchListItem[]> {
  const batches = await prisma.importBatch.findMany({
    where: { tenantId, tipo: "PRATICHE" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const items: ImportBatchListItem[] = [];
  for (const b of batches) {
    const pratiche = await prisma.pratica.findMany({
      where: importBatchPraticheWhere(tenantId, {
        mandanteId: b.mandanteId,
        lotto: b.lotto,
        affidoIl: b.affidoIl,
      }),
      select: { id: true, note: true, codiceScaricoAt: true, importBatchId: true },
    });
    const ids = pratiche.map((p) => p.id);
    const nPratiche = ids.length;
    if (nPratiche !== b.nPratiche) {
      await prisma.importBatch
        .update({ where: { id: b.id }, data: { nPratiche } })
        .catch(() => undefined);
    }
    for (const p of pratiche) {
      if (p.importBatchId !== b.id) {
        await prisma.pratica
          .update({ where: { id: p.id }, data: { importBatchId: b.id } })
          .catch(() => undefined);
      }
    }
    const nNote = pratiche.filter((p) => praticaHaNote(p.note)).length;
    const nCodice = pratiche.filter((p) =>
      praticaHaCambioCodice(p.codiceScaricoAt)
    ).length;
    let nIncassi = 0;
    if (ids.length) {
      nIncassi = await prisma.incasso.count({
        where: { praticaId: { in: ids } },
      });
    }
    const blocchi = { note: nNote, codice: nCodice, incassi: nIncassi };
    items.push({
      id: b.id,
      mandanteId: b.mandanteId,
      mandanteCodice: b.mandanteCodice,
      perimetro: b.perimetro,
      lotto: b.lotto,
      affidoIl:
        b.affidoIl instanceof Date
          ? b.affidoIl.toISOString().slice(0, 10)
          : String(b.affidoIl).slice(0, 10),
      scadenzaMandato: (() => {
        const s = (b as { scadenzaMandato?: Date | string | null }).scadenzaMandato;
        if (!s) return null;
        return s instanceof Date
          ? s.toISOString().slice(0, 10)
          : String(s).slice(0, 10);
      })(),
      fileName: b.fileName ?? null,
      nPratiche,
      createdAt:
        b.createdAt instanceof Date
          ? b.createdAt.toISOString()
          : String(b.createdAt),
      createdByName: b.createdByName ?? null,
      hasMovimenti: nIncassi > 0,
      hasNote: nNote > 0,
      hasCambioCodice: nCodice > 0,
      blocchi,
    });
  }
  return items;
}

const ELIMINA_IMPORT_CHUNK = 5;

export type EliminaImportBatchPrepareResult =
  | { error: string }
  | {
      batchId: string;
      lotto: string;
      mandanteCodice: string;
      praticaIds: string[];
      debitoreIds: string[];
      total: number;
    };

async function deletePraticaImportCascade(praticaId: string) {
  await prisma.praticaLock.deleteMany({ where: { praticaId } }).catch(() => undefined);
  await prisma.attivita.deleteMany({ where: { praticaId } });
  await prisma.fattura.deleteMany({ where: { praticaId } });
  await prisma.pianoRata.deleteMany({ where: { praticaId } });
  await prisma.documento.deleteMany({ where: { praticaId } });
  await prisma.provvigione.deleteMany({ where: { praticaId } }).catch(() => undefined);
  await prisma.messaggioAgenda.deleteMany({ where: { praticaId } }).catch(() => undefined);
  await prisma.messaggioInterno.deleteMany({ where: { praticaId } }).catch(() => undefined);
  await prisma.registrazioneChiamata.deleteMany({ where: { praticaId } }).catch(() => undefined);

  const garanti = await prisma.garante.findMany({
    where: { praticaId },
    select: { id: true },
  });
  for (const g of garanti) {
    await prisma.garanteRecapito.deleteMany({ where: { garanteId: g.id } });
  }
  await prisma.garante.deleteMany({ where: { praticaId } });
  await prisma.pratica.delete({ where: { id: praticaId } });
}

async function loadImportBatchPratiche(tenantId: string, batchId: string) {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, tenantId, tipo: "PRATICHE" },
  });
  if (!batch) return { error: "Import non trovato" as const };

  const pratiche = await prisma.pratica.findMany({
    where: importBatchPraticheWhere(tenantId, {
      mandanteId: batch.mandanteId,
      lotto: batch.lotto,
      affidoIl: batch.affidoIl,
    }),
    select: {
      id: true,
      debitoreId: true,
      note: true,
      codiceScaricoAt: true,
    },
  });

  return { batch, pratiche };
}

function validaEliminaImportPratiche(
  pratiche: Array<{
    id: string;
    note: string | null;
    codiceScaricoAt: Date | string | null;
  }>
) {
  const praticaIds = pratiche.map((p) => p.id);

  const nConNote = pratiche.filter((p) => praticaHaNote(p.note)).length;
  if (nConNote > 0) {
    return {
      error: `Impossibile eliminare: ci sono ${nConNote} pratiche con note`,
    };
  }

  const nConCodice = pratiche.filter((p) =>
    praticaHaCambioCodice(p.codiceScaricoAt)
  ).length;
  if (nConCodice > 0) {
    return {
      error: `Impossibile eliminare: ci sono ${nConCodice} pratiche con cambio codice`,
    };
  }

  return { praticaIds };
}

/** Prepara l'eliminazione: validazioni e elenco pratiche/debitori. */
export async function eliminaImportBatchPrepareAction(
  formData: FormData
): Promise<EliminaImportBatchPrepareResult> {
  const user = await requireWritablePermission("import:run");
  const batchId = String(formData.get("batchId") || "").trim();
  if (!batchId) return { error: "Import non specificato" };

  const loaded = await loadImportBatchPratiche(user.tenantId, batchId);
  if ("error" in loaded) {
    return { error: loaded.error ?? "Import non trovato" };
  }
  const { batch, pratiche } = loaded;

  const valid = validaEliminaImportPratiche(pratiche);
  if ("error" in valid) {
    return { error: valid.error ?? "Eliminazione non consentita" };
  }

  if (valid.praticaIds.length) {
    const nIncassi = await prisma.incasso.count({
      where: { praticaId: { in: valid.praticaIds } },
    });
    if (nIncassi > 0) {
      return {
        error: `Impossibile eliminare: ci sono ${nIncassi} movimenti (incassi) collegati`,
      };
    }
  }

  return {
    batchId: batch.id,
    lotto: batch.lotto,
    mandanteCodice: batch.mandanteCodice,
    praticaIds: valid.praticaIds,
    debitoreIds: [...new Set(pratiche.map((p) => p.debitoreId))],
    total: valid.praticaIds.length,
  };
}

/** Elimina un gruppo di pratiche dell'import (per avanzamento progressivo). */
export async function eliminaImportBatchChunkAction(formData: FormData) {
  const user = await requireWritablePermission("import:run");
  const batchId = String(formData.get("batchId") || "").trim();
  const rawIds = String(formData.get("praticaIds") || "").trim();
  if (!batchId || !rawIds) return { error: "Parametri eliminazione mancanti" };

  let praticaIds: string[];
  try {
    praticaIds = JSON.parse(rawIds) as string[];
  } catch {
    return { error: "Elenco pratiche non valido" };
  }
  if (!Array.isArray(praticaIds) || !praticaIds.length) {
    return { error: "Nessuna pratica da eliminare" };
  }

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, tenantId: user.tenantId, tipo: "PRATICHE" },
    select: { id: true, mandanteId: true, lotto: true, affidoIl: true },
  });
  if (!batch) return { error: "Import non trovato" };

  const pratiche = await prisma.pratica.findMany({
    where: {
      id: { in: praticaIds },
      ...importBatchPraticheWhere(user.tenantId, {
        mandanteId: batch.mandanteId,
        lotto: batch.lotto,
        affidoIl: batch.affidoIl,
      }),
    },
    select: { id: true },
  });
  if (pratiche.length !== praticaIds.length) {
    return { error: "Alcune pratiche non appartengono a questo import" };
  }

  for (const p of pratiche) {
    await deletePraticaImportCascade(p.id);
  }

  return { deleted: pratiche.length };
}

/** Conclude l'eliminazione: debitori orfani, batch e audit. */
export async function eliminaImportBatchFinalizeAction(formData: FormData) {
  const user = await requireWritablePermission("import:run");
  const batchId = String(formData.get("batchId") || "").trim();
  const rawDebitoreIds = String(formData.get("debitoreIds") || "").trim();
  const nPratiche = Number(formData.get("nPratiche") || 0);
  if (!batchId) return { error: "Import non specificato" };

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, tenantId: user.tenantId, tipo: "PRATICHE" },
  });
  if (!batch) return { error: "Import non trovato" };

  const restanti = await prisma.pratica.count({
    where: importBatchPraticheWhere(user.tenantId, {
      mandanteId: batch.mandanteId,
      lotto: batch.lotto,
      affidoIl: batch.affidoIl,
    }),
  });
  if (restanti > 0) {
    return { error: "Eliminazione incompleta: ci sono ancora pratiche collegate" };
  }

  let debitoreIds: string[] = [];
  if (rawDebitoreIds) {
    try {
      debitoreIds = JSON.parse(rawDebitoreIds) as string[];
    } catch {
      return { error: "Elenco debitori non valido" };
    }
  }

  for (const debitoreId of debitoreIds) {
    const altre = await prisma.pratica.count({ where: { debitoreId } });
    if (altre > 0) continue;
    await prisma.debitoreRecapito.deleteMany({ where: { debitoreId } });
    await prisma.debitore.delete({ where: { id: debitoreId } }).catch(() => undefined);
  }

  await prisma.importBatch.delete({ where: { id: batchId } });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "delete_import",
    entity: "importBatch",
    entityId: batchId,
    dettaglio: `lotto ${batch.lotto} · ${nPratiche} pratiche · ${batch.mandanteCodice}`,
  });

  revalidatePath("/import");
  revalidatePath("/pratiche");
  return { ok: `Eliminato import: ${nPratiche} pratiche (lotto ${batch.lotto})` };
}

/** Elimina un import pratiche solo se nessuna pratica ha incassi. */
export async function eliminaImportBatchAction(formData: FormData) {
  const prepared = await eliminaImportBatchPrepareAction(formData);
  if ("error" in prepared) return prepared;

  for (let i = 0; i < prepared.praticaIds.length; i += ELIMINA_IMPORT_CHUNK) {
    const chunk = prepared.praticaIds.slice(i, i + ELIMINA_IMPORT_CHUNK);
    const fd = new FormData();
    fd.set("batchId", prepared.batchId);
    fd.set("praticaIds", JSON.stringify(chunk));
    const res = await eliminaImportBatchChunkAction(fd);
    if ("error" in res) return res;
  }

  const fd = new FormData();
  fd.set("batchId", prepared.batchId);
  fd.set("debitoreIds", JSON.stringify(prepared.debitoreIds));
  fd.set("nPratiche", String(prepared.total));
  return eliminaImportBatchFinalizeAction(fd);
}
