"use server";

import { revalidatePath } from "next/cache";
import { debitoriDb, debitoreRecapitoDb } from "@/lib/debitoriRepo";
import { incassiDb } from "@/lib/incassiRepo";
import { importBatchRepo } from "@/lib/importBatchRepo";
import { praticaDb } from "@/lib/praticheRepo";
import { releasePraticaLockForImport } from "@/lib/praticaLock";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import {
  praticaHaCambioCodice,
  praticaHaNote,
  type ImportBatchListItem,
} from "@/lib/importBatch";
import { importBatchPraticheWhere } from "@/lib/importBatchPratiche";

export async function listImportBatchPratiche(
  tenantId: string,
  tenantSlug?: string
): Promise<ImportBatchListItem[]> {
  const slug = tenantSlug ?? tenantId;
  const dbCtx = { tenantId, tenantSlug: slug };
  const incassoModel = incassiDb(dbCtx);
  const repo = importBatchRepo(dbCtx);
  const praticaModel = praticaDb({ ...dbCtx, role: "ADMIN", userId: "" });
  const batches = await repo.list(slug, tenantId, { tipo: "PRATICHE", take: 50 });

  const items: ImportBatchListItem[] = [];
  for (const b of batches) {
    const pratiche = await praticaModel.findMany({
      where: importBatchPraticheWhere(tenantId, {
        mandanteId: b.mandanteId,
        lotto: b.lotto,
        affidoIl: new Date(b.affidoIl),
      }),
      select: { id: true, note: true, codiceScaricoAt: true },
    });
    const ids = pratiche.map((p) => p.id as string);
    const nPratiche = ids.length;
    if (nPratiche !== b.nPratiche) {
      await repo.update(slug, tenantId, b.id, { nPratiche }).catch(() => undefined);
    }
    const nNote = pratiche.filter((p) => praticaHaNote(p.note)).length;
    const nCodice = pratiche.filter((p) =>
      praticaHaCambioCodice(p.codiceScaricoAt)
    ).length;
    let nIncassi = 0;
    if (ids.length) {
      nIncassi = await incassoModel.count({
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
      affidoIl: new Date(b.affidoIl).toISOString().slice(0, 10),
      scadenzaMandato: b.scadenzaMandato ? b.scadenzaMandato.slice(0, 10) : null,
      fileName: b.fileName ?? null,
      nPratiche,
      createdAt: b.createdAt,
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

async function deletePraticaImportCascade(
  praticaId: string,
  dbCtx: { tenantId: string; tenantSlug: string }
) {
  await releasePraticaLockForImport(praticaId, dbCtx).catch(() => undefined);
  await importBatchRepo(dbCtx).deletePraticaForImport(
    dbCtx.tenantSlug,
    dbCtx.tenantId,
    praticaId
  );
}

async function loadImportBatchPratiche(tenantId: string, tenantSlug: string, batchId: string) {
  const repo = importBatchRepo({ tenantId, tenantSlug });
  const batch = await repo.getById(tenantSlug, tenantId, batchId);
  if (!batch || batch.tipo !== "PRATICHE") return { error: "Import non trovato" as const };

  const praticaModel = praticaDb({ tenantId, tenantSlug, role: "ADMIN", userId: "" });
  const pratiche = await praticaModel.findMany({
    where: importBatchPraticheWhere(tenantId, {
      mandanteId: batch.mandanteId,
      lotto: batch.lotto,
      affidoIl: new Date(batch.affidoIl),
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

  const loaded = await loadImportBatchPratiche(user.tenantId, user.tenantSlug ?? user.tenantId, batchId);
  if ("error" in loaded) {
    return { error: loaded.error ?? "Import non trovato" };
  }
  const { batch, pratiche } = loaded;

  const valid = validaEliminaImportPratiche(pratiche);
  if ("error" in valid) {
    return { error: valid.error ?? "Eliminazione non consentita" };
  }

  if (valid.praticaIds.length) {
    const incassoModel = incassiDb({ tenantId: user.tenantId, tenantSlug: user.tenantSlug ?? user.tenantId });
    const nIncassi = await incassoModel.count({
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

  const slug = user.tenantSlug ?? user.tenantId;
  const repo = importBatchRepo({ tenantId: user.tenantId, tenantSlug: slug });
  const batch = await repo.getById(slug, user.tenantId, batchId);
  if (!batch) return { error: "Import non trovato" };

  const praticaModel = praticaDb({ tenantId: user.tenantId, tenantSlug: slug, role: "ADMIN", userId: "" });
  const pratiche = await praticaModel.findMany({
    where: {
      id: { in: praticaIds },
      ...importBatchPraticheWhere(user.tenantId, {
        mandanteId: batch.mandanteId,
        lotto: batch.lotto,
        affidoIl: new Date(batch.affidoIl),
      }),
    },
    select: { id: true },
  });
  if (pratiche.length !== praticaIds.length) {
    return { error: "Alcune pratiche non appartengono a questo import" };
  }

  for (const p of pratiche) {
    await deletePraticaImportCascade(p.id, {
      tenantId: user.tenantId,
      tenantSlug: slug,
    });
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

  const slug = user.tenantSlug ?? user.tenantId;
  const repo = importBatchRepo({ tenantId: user.tenantId, tenantSlug: slug });
  const batch = await repo.getById(slug, user.tenantId, batchId);
  if (!batch) return { error: "Import non trovato" };

  const praticaModel = praticaDb({ tenantId: user.tenantId, tenantSlug: slug, role: "ADMIN", userId: "" });
  const restanti = await praticaModel.count({
    where: importBatchPraticheWhere(user.tenantId, {
      mandanteId: batch.mandanteId,
      lotto: batch.lotto,
      affidoIl: new Date(batch.affidoIl),
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
    const altre = await praticaModel.count({ where: { debitoreId } });
    if (altre > 0) continue;
    const dbCtx = {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug ?? user.tenantId,
    };
    await debitoreRecapitoDb(dbCtx).deleteMany({ where: { debitoreId } });
    await debitoriDb(dbCtx).delete({ where: { id: debitoreId } }).catch(() => undefined);
  }

  await repo.delete(slug, user.tenantId, batchId);

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: slug,
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
