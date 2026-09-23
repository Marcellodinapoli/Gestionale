import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import { PrismaImportBatchRepository } from "@/lib/data/prisma/PrismaImportBatchRepository";
import type {
  ConferimentoImportBatchInput,
  ImportBatchCreateInput,
  ImportBatchDto,
  ImportBatchUpdateInput,
} from "@/lib/data/contracts/importBatch";
import { praticaDb } from "@/lib/praticheRepo";

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapBatch(row: Record<string, unknown>): ImportBatchDto {
  const m = mapSqlRow(row);
  return {
    id: String(m.id),
    tenantId: String(m.tenantId),
    tipo: String(m.tipo ?? "PRATICHE"),
    mandanteId: String(m.mandanteId),
    mandanteCodice: String(m.mandanteCodice ?? ""),
    perimetro: String(m.perimetro ?? ""),
    lotto: String(m.lotto ?? ""),
    affidoIl: toIso(m.affidoIl) ?? new Date(0).toISOString(),
    scadenzaMandato: toIso(m.scadenzaMandato),
    conferimentoTipo: m.conferimentoTipo != null ? String(m.conferimentoTipo) : null,
    fileName: m.fileName != null ? String(m.fileName) : null,
    nPratiche: Number(m.nPratiche ?? 0),
    createdById: m.createdById != null ? String(m.createdById) : null,
    createdByName: m.createdByName != null ? String(m.createdByName) : null,
    createdAt: toIso(m.createdAt) ?? new Date(0).toISOString(),
  };
}

/**
 * ImportBatch su Neon Postgres.
 * processImportChunk / deletePratica / link restano sulla classe Prisma
 * (usano già debitoriDb/praticaDb Neon-aware).
 */
export class NeonImportBatchRepository extends PrismaImportBatchRepository {
  constructor(private _tenantSlug: string) {
    super();
  }

  async findByLotKey(
    _tenantSlug: string,
    tenantId: string,
    input: { mandanteId: string; perimetro: string; lotto: string; tipo?: string }
  ) {
    const rows = await neonQuery(
      `SELECT * FROM "ImportBatch"
       WHERE "TenantId" = $1::uuid
         AND "Tipo" = $2
         AND "MandanteId" = $3::uuid
         AND "Perimetro" = $4
         AND "Lotto" = $5
       ORDER BY "CreatedAt" DESC
       LIMIT 1`,
      [tenantId, input.tipo ?? "PRATICHE", input.mandanteId, input.perimetro, input.lotto]
    );
    return rows[0] ? mapBatch(rows[0] as Record<string, unknown>) : null;
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    const rows = await neonQuery(
      `SELECT * FROM "ImportBatch"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapBatch(rows[0] as Record<string, unknown>) : null;
  }

  async list(_tenantSlug: string, tenantId: string, filter?: { tipo?: string; take?: number }) {
    const take = filter?.take ?? 50;
    const rows = await neonQuery(
      `SELECT * FROM "ImportBatch"
       WHERE "TenantId" = $1::uuid AND "Tipo" = $2
       ORDER BY "CreatedAt" DESC
       LIMIT $3`,
      [tenantId, filter?.tipo ?? "PRATICHE", take]
    );
    return rows.map((r) => mapBatch(r as Record<string, unknown>));
  }

  async create(_tenantSlug: string, tenantId: string, data: ImportBatchCreateInput) {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "ImportBatch" (
         "Id","TenantId","Tipo","MandanteId","MandanteCodice","Perimetro","Lotto",
         "AffidoIl","ScadenzaMandato","FileName","NPratiche","CreatedById","CreatedByName","CreatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7,
         $8::timestamptz,$9::timestamptz,$10,$11,$12::uuid,$13,NOW()
       )`,
      [
        id,
        tenantId,
        data.tipo ?? "PRATICHE",
        data.mandanteId,
        data.mandanteCodice,
        data.perimetro,
        data.lotto,
        new Date(data.affidoIl).toISOString(),
        data.scadenzaMandato ? new Date(data.scadenzaMandato).toISOString() : null,
        data.fileName ?? null,
        data.nPratiche ?? 0,
        data.createdById ?? null,
        data.createdByName ?? null,
      ]
    );
    const row = await this.getById(_tenantSlug, tenantId, id);
    if (!row) throw new Error("Creazione import batch fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: ImportBatchUpdateInput
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (data.nPratiche != null) {
      sets.push(`"NPratiche" = $${i++}`);
      params.push(data.nPratiche);
    }
    if (data.fileName !== undefined) {
      sets.push(`"FileName" = $${i++}`);
      params.push(data.fileName);
    }
    if (data.scadenzaMandato !== undefined) {
      if (data.scadenzaMandato == null) sets.push(`"ScadenzaMandato" = NULL`);
      else {
        sets.push(`"ScadenzaMandato" = $${i++}::timestamptz`);
        params.push(new Date(data.scadenzaMandato).toISOString());
      }
    }
    if (sets.length) {
      params.push(id, tenantId);
      await neonQuery(
        `UPDATE "ImportBatch" SET ${sets.join(", ")}
         WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
        params
      );
    }
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Import batch non trovato");
    return row;
  }

  async delete(_tenantSlug: string, tenantId: string, id: string) {
    await neonQuery(
      `DELETE FROM "ImportBatch" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
  }

  async applyConferimento(
    tenantSlug: string,
    tenantId: string,
    batchId: string,
    data: ConferimentoImportBatchInput
  ) {
    const dataPassaggio = data.dataPassaggioGiudiziale
      ? new Date(data.dataPassaggioGiudiziale).toISOString()
      : null;
    const prossima = data.prossimaAttivitaAlloScadere?.trim() || null;
    await neonQuery(
      `UPDATE "ImportBatch"
       SET "ConferimentoTipo" = $1,
           "DataPassaggioGiudiziale" = $2::timestamptz,
           "ProssimaAttivitaAlloScadere" = $3
       WHERE "Id" = $4::uuid AND "TenantId" = $5::uuid`,
      [data.conferimentoTipo, dataPassaggio, prossima, batchId, tenantId]
    );
    const praticaModel = praticaDb({ tenantId, tenantSlug, role: "ADMIN", userId: "" });
    const result = await praticaModel.updateMany({
      where: { tenantId, importBatchId: batchId },
      data: {
        conferimentoTipo: data.conferimentoTipo,
        dataPassaggioGiudiziale: dataPassaggio ? new Date(dataPassaggio) : null,
        prossimaAttivitaAlloScadere: prossima,
      },
    });
    return { ok: true as const, updatedPratiche: Number(result.count ?? 0) };
  }
}

export function createNeonImportBatchRepository(tenantSlug: string) {
  return new NeonImportBatchRepository(tenantSlug);
}
