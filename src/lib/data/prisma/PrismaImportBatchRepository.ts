import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  ImportBatchCreateInput,
  ImportBatchDto,
  ImportBatchRepository,
  ImportBatchUpdateInput,
  ImportChunkResult,
  ImportPraticaCreateItem,
  ImportPraticaUpdateItem,
} from "../contracts/importBatch";
import { debitoriDb } from "@/lib/debitoriRepo";
import { praticaDb } from "@/lib/praticheRepo";
import { attivitaDb } from "@/lib/attivitaRepo";
import { fattureDb } from "@/lib/fattureRepo";
import { documentiDb } from "@/lib/documentiRepo";
import { pianoRateDb } from "@/lib/pianoRateRepo";
import { provvigioniDb } from "@/lib/provvigioniRepo";
import { registrazioniDb } from "@/lib/registrazioniRepo";
import { deleteGarantiByPratica } from "@/lib/garantiRepo";
import { messaggiAgendaRepo } from "@/lib/messaggiAgendaRepo";
import { messaggiInterniRepo } from "@/lib/messaggiInterniRepo";
import { importBatchPraticheWhere } from "@/lib/importBatchPratiche";

function mapRow(b: {
  id: string;
  tenantId: string;
  tipo: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: Date;
  scadenzaMandato: Date | null;
  fileName: string | null;
  nPratiche: number;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
}): ImportBatchDto {
  return {
    id: b.id,
    tenantId: b.tenantId,
    tipo: b.tipo,
    mandanteId: b.mandanteId,
    mandanteCodice: b.mandanteCodice,
    perimetro: b.perimetro,
    lotto: b.lotto,
    affidoIl: b.affidoIl.toISOString(),
    scadenzaMandato: b.scadenzaMandato?.toISOString() ?? null,
    fileName: b.fileName,
    nPratiche: b.nPratiche,
    createdById: b.createdById,
    createdByName: b.createdByName,
    createdAt: b.createdAt.toISOString(),
  };
}

export class PrismaImportBatchRepository implements ImportBatchRepository {
  async findByLotKey(
    _tenantSlug: string,
    tenantId: string,
    input: { mandanteId: string; perimetro: string; lotto: string; tipo?: string }
  ) {
    const row = await prisma.importBatch.findFirst({
      where: {
        tenantId,
        tipo: input.tipo ?? "PRATICHE",
        mandanteId: input.mandanteId,
        perimetro: input.perimetro,
        lotto: input.lotto,
      },
      orderBy: { createdAt: "desc" },
    });
    return row ? mapRow(row) : null;
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    const row = await prisma.importBatch.findFirst({ where: { id, tenantId } });
    return row ? mapRow(row) : null;
  }

  async list(_tenantSlug: string, tenantId: string, filter?: { tipo?: string; take?: number }) {
    const rows = await prisma.importBatch.findMany({
      where: { tenantId, tipo: filter?.tipo ?? "PRATICHE" },
      orderBy: { createdAt: "desc" },
      take: filter?.take ?? 50,
    });
    return rows.map(mapRow);
  }

  async create(_tenantSlug: string, tenantId: string, data: ImportBatchCreateInput) {
    const row = await prisma.importBatch.create({
      data: {
        tenantId,
        tipo: data.tipo ?? "PRATICHE",
        mandanteId: data.mandanteId,
        mandanteCodice: data.mandanteCodice,
        perimetro: data.perimetro,
        lotto: data.lotto,
        affidoIl: new Date(data.affidoIl),
        scadenzaMandato: data.scadenzaMandato ? new Date(data.scadenzaMandato) : undefined,
        fileName: data.fileName ?? undefined,
        nPratiche: data.nPratiche ?? 0,
        createdById: data.createdById ?? undefined,
        createdByName: data.createdByName ?? undefined,
      },
    });
    return mapRow(row);
  }

  async update(_tenantSlug: string, tenantId: string, id: string, data: ImportBatchUpdateInput) {
    const row = await prisma.importBatch.update({
      where: { id },
      data: {
        ...(data.nPratiche != null ? { nPratiche: data.nPratiche } : {}),
        ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
        ...(data.scadenzaMandato !== undefined
          ? { scadenzaMandato: data.scadenzaMandato ? new Date(data.scadenzaMandato) : null }
          : {}),
      },
    });
    void tenantId;
    return mapRow(row);
  }

  async delete(_tenantSlug: string, _tenantId: string, id: string) {
    await prisma.importBatch.delete({ where: { id } });
  }

  async processImportChunk(
    tenantSlug: string,
    tenantId: string,
    input: { creates: ImportPraticaCreateItem[]; updates: ImportPraticaUpdateItem[] }
  ): Promise<ImportChunkResult> {
    const dbCtx = { tenantId, tenantSlug };
    const debitoreModel = debitoriDb(dbCtx);
    const praticaModel = praticaDb({ ...dbCtx, role: "ADMIN", userId: "" });

    for (const u of input.updates) {
      await debitoreModel.update({ where: { id: u.debitoreId }, data: u.debitore as never });
      await praticaModel.update({ where: { id: u.praticaId }, data: u.pratica as never });
    }

    const createdPratiche: ImportChunkResult["createdPratiche"] = [];
    for (const c of input.creates) {
      const debitore = await debitoreModel.create({
        data: { tenantId, ...c.debitore } as never,
      });
      const last = await praticaModel.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        select: { numero: true },
      });
      const year = new Date().getFullYear();
      const match = last?.numero?.match(/(\d+)$/);
      const n = match ? Number(match[1]) + 1 : 1;
      const numero = `PRC-${year}-${String(n).padStart(4, "0")}`;
      const pratica = await praticaModel.create({
        data: {
          tenantId,
          numero,
          debitoreId: debitore.id,
          ...c.pratica,
        } as never,
      });
      createdPratiche?.push({
        id: pratica.id as string,
        debitoreId: debitore.id as string,
        contratto: c.pratica.contratto ?? null,
        commessa: c.pratica.commessa ?? null,
        stato: c.pratica.stato,
        codiceFiscale: c.debitore.codiceFiscale ?? null,
      });
    }

    return {
      created: input.creates.length,
      updated: input.updates.length,
      skipped: 0,
      createdPratiche,
    };
  }

  async linkPraticheToBatch(
    tenantSlug: string,
    tenantId: string,
    input: { batchId: string; mandanteId: string; lotto: string; affidoIl: string }
  ) {
    const praticaModel = praticaDb({ tenantId, tenantSlug, role: "ADMIN", userId: "" });
    const praticheBatch = await praticaModel.findMany({
      where: importBatchPraticheWhere(tenantId, {
        mandanteId: input.mandanteId,
        lotto: input.lotto,
        affidoIl: new Date(input.affidoIl),
      }),
      select: { id: true, importBatchId: true },
    });
    for (const p of praticheBatch) {
      if ((p as { importBatchId?: string }).importBatchId !== input.batchId) {
        await praticaModel
          .update({
            where: { id: p.id as string },
            data: { importBatchId: input.batchId },
          })
          .catch(() => undefined);
      }
    }
    return { totale: praticheBatch.length };
  }

  async deletePraticaForImport(tenantSlug: string, tenantId: string, praticaId: string) {
    const dbCtx = { tenantId, tenantSlug };
    await attivitaDb(dbCtx).deleteMany({ where: { praticaId } });
    await fattureDb(dbCtx).deleteMany({ where: { praticaId } });
    await pianoRateDb(dbCtx).deleteMany({ where: { praticaId } });
    await documentiDb(dbCtx).deleteMany({ where: { praticaId } });
    await provvigioniDb(dbCtx).deleteMany({ where: { praticaId } }).catch(() => undefined);
    await messaggiAgendaRepo(dbCtx).deleteByPratica(tenantSlug, tenantId, praticaId).catch(() => undefined);
    await messaggiInterniRepo(dbCtx).deleteByPratica(tenantSlug, tenantId, praticaId).catch(() => undefined);
    await registrazioniDb(dbCtx).deleteMany({ where: { praticaId } }).catch(() => undefined);
    await deleteGarantiByPratica(dbCtx, praticaId);
    const praticaModel = praticaDb({ tenantId, tenantSlug, role: "ADMIN", userId: "" });
    await praticaModel.delete({ where: { id: praticaId } });
  }
}

export const prismaImportBatchRepository = new PrismaImportBatchRepository();
