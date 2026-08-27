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
      where: { tenantId, importBatchId: b.id },
      select: { id: true, note: true, codiceScarico: true },
    });
    const ids = pratiche.map((p) => p.id);
    const hasNote = pratiche.some((p) => praticaHaNote(p.note));
    const hasCambioCodice = pratiche.some((p) =>
      praticaHaCambioCodice(p.codiceScarico)
    );
    let hasMovimenti = false;
    if (ids.length) {
      const nIncassi = await prisma.incasso.count({
        where: { praticaId: { in: ids } },
      });
      hasMovimenti = nIncassi > 0;
    }
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
      nPratiche: b.nPratiche || ids.length,
      createdAt:
        b.createdAt instanceof Date
          ? b.createdAt.toISOString()
          : String(b.createdAt),
      createdByName: b.createdByName ?? null,
      hasMovimenti,
      hasNote,
      hasCambioCodice,
    });
  }
  return items;
}

/** Elimina un import pratiche solo se nessuna pratica ha incassi. */
export async function eliminaImportBatchAction(formData: FormData) {
  const user = await requireWritablePermission("import:run");
  const batchId = String(formData.get("batchId") || "").trim();
  if (!batchId) return { error: "Import non specificato" };

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, tenantId: user.tenantId, tipo: "PRATICHE" },
  });
  if (!batch) return { error: "Import non trovato" };

  const pratiche = await prisma.pratica.findMany({
    where: { tenantId: user.tenantId, importBatchId: batchId },
    select: { id: true, debitoreId: true, note: true, codiceScarico: true },
  });
  const praticaIds = pratiche.map((p) => p.id);

  const nConNote = pratiche.filter((p) => praticaHaNote(p.note)).length;
  if (nConNote > 0) {
    return {
      error: `Impossibile eliminare: ci sono ${nConNote} pratiche con note`,
    };
  }

  const nConCodice = pratiche.filter((p) =>
    praticaHaCambioCodice(p.codiceScarico)
  ).length;
  if (nConCodice > 0) {
    return {
      error: `Impossibile eliminare: ci sono ${nConCodice} pratiche con cambio codice`,
    };
  }

  if (praticaIds.length) {
    const nIncassi = await prisma.incasso.count({
      where: { praticaId: { in: praticaIds } },
    });
    if (nIncassi > 0) {
      return {
        error: `Impossibile eliminare: ci sono ${nIncassi} movimenti (incassi) collegati`,
      };
    }
  }

  for (const p of pratiche) {
    await prisma.praticaLock.deleteMany({ where: { praticaId: p.id } }).catch(() => undefined);
    await prisma.attivita.deleteMany({ where: { praticaId: p.id } });
    await prisma.fattura.deleteMany({ where: { praticaId: p.id } });
    await prisma.pianoRata.deleteMany({ where: { praticaId: p.id } });
    await prisma.documento.deleteMany({ where: { praticaId: p.id } });
    await prisma.provvigione.deleteMany({ where: { praticaId: p.id } }).catch(() => undefined);
    await prisma.messaggioAgenda.deleteMany({ where: { praticaId: p.id } }).catch(() => undefined);
    await prisma.messaggioInterno.deleteMany({ where: { praticaId: p.id } }).catch(() => undefined);
    await prisma.registrazioneChiamata.deleteMany({ where: { praticaId: p.id } }).catch(() => undefined);

    const garanti = await prisma.garante.findMany({
      where: { praticaId: p.id },
      select: { id: true },
    });
    for (const g of garanti) {
      await prisma.garanteRecapito.deleteMany({ where: { garanteId: g.id } });
    }
    await prisma.garante.deleteMany({ where: { praticaId: p.id } });
    await prisma.pratica.delete({ where: { id: p.id } });
  }

  // Debitori orfani (solo di queste pratiche)
  const debitoreIds = [...new Set(pratiche.map((p) => p.debitoreId))];
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
    dettaglio: `lotto ${batch.lotto} · ${pratiche.length} pratiche · ${batch.mandanteCodice}`,
  });

  revalidatePath("/import");
  revalidatePath("/pratiche");
  return { ok: `Eliminato import: ${pratiche.length} pratiche (lotto ${batch.lotto})` };
}
