import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  DebitoreCreateInput,
  DebitoreFilter,
  DebitoreListRequest,
  DebitoreUpdateInput,
  DebitoriRepository,
  DebitoreDto,
  RecapitoCreateInput,
} from "@/lib/data/contracts/debitori";

function mapDebitore(row: Record<string, unknown>): DebitoreDto {
  return mapSqlRow(row);
}

function filterSql(
  filter: DebitoreFilter | undefined,
  startIdx: number
): { sql: string; params: unknown[]; next: number } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIdx;
  const ids = filter?.ids ?? filter?.idsIn;
  if (ids?.length === 1) {
    parts.push(`d."Id" = $${i++}::uuid`);
    params.push(ids[0]);
  } else if (ids?.length) {
    parts.push(`d."Id" = ANY($${i++}::uuid[])`);
    params.push(ids);
  }
  if (filter?.codiceFiscaleIn?.length) {
    parts.push(`d."CodiceFiscale" = ANY($${i++}::text[])`);
    params.push(filter.codiceFiscaleIn);
  }
  if (filter?.q?.trim()) {
    parts.push(
      `(d."Nome" ILIKE $${i} OR d."Cognome" ILIKE $${i} OR d."CodiceFiscale" ILIKE $${i})`
    );
    params.push(`%${filter.q.trim()}%`);
    i += 1;
  }
  return {
    sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    params,
    next: i,
  };
}

const FIELD_MAP: Record<string, string> = {
  nome: "Nome",
  cognome: "Cognome",
  codiceFiscale: "CodiceFiscale",
  telefono: "Telefono",
  telefonoStato: "TelefonoStato",
  email: "Email",
  indirizzo: "Indirizzo",
  citta: "Citta",
  cap: "Cap",
  provincia: "Provincia",
  ndg: "Ndg",
};

export class NeonDebitoriRepository implements DebitoriRepository {
  constructor(private _tenantSlug: string) {}

  async list(req: DebitoreListRequest): Promise<{ items: DebitoreDto[]; total: number }> {
    const filt = filterSql(req.filter, 2);
    const where = `d."TenantId" = $1::uuid${filt.sql}`;
    const params = [req.tenantId, ...filt.params];
    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Debitori" d WHERE ${where}`,
      params
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);
    const take = req.take ?? 500;
    const skip = req.skip ?? 0;
    const rows = await neonQuery(
      `SELECT d.*
       FROM "Debitori" d
       WHERE ${where}
       ORDER BY d."Cognome", d."Nome"
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, take, skip]
    );
    return { items: rows.map((r) => mapDebitore(r as Record<string, unknown>)), total };
  }

  async idsByCf(_tenantSlug: string, tenantId: string, variants: string[]) {
    if (!variants.length) return [];
    const rows = await neonQuery(
      `SELECT "Id", "CodiceFiscale" FROM "Debitori"
       WHERE "TenantId" = $1::uuid AND "CodiceFiscale" = ANY($2::text[])`,
      [tenantId, variants]
    );
    return rows.map((r) => mapDebitore(r as Record<string, unknown>));
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    const rows = await neonQuery(
      `SELECT * FROM "Debitori"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapDebitore(rows[0] as Record<string, unknown>) : null;
  }

  async create(_tenantSlug: string, data: DebitoreCreateInput): Promise<DebitoreDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "Debitori" (
         "Id","TenantId","Nome","Cognome","CodiceFiscale","Telefono","TelefonoStato",
         "Email","Indirizzo","Citta","Cap","Provincia","Ndg","CreatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,$12,$13,NOW()
       )`,
      [
        id,
        data.tenantId,
        data.nome,
        data.cognome ?? "",
        data.codiceFiscale ?? null,
        data.telefono ?? null,
        data.telefonoStato ?? null,
        data.email ?? null,
        data.indirizzo ?? null,
        data.citta ?? null,
        data.cap ?? null,
        data.provincia ?? null,
        data.ndg ?? null,
      ]
    );
    const row = await this.getById(_tenantSlug, data.tenantId, id);
    if (!row) throw new Error("Creazione debitore fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: DebitoreUpdateInput
  ): Promise<DebitoreDto> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      const val = (data as Record<string, unknown>)[key];
      if (val === undefined) continue;
      if (val == null) sets.push(`"${col}" = NULL`);
      else {
        sets.push(`"${col}" = $${i++}`);
        params.push(val);
      }
    }
    if (sets.length) {
      params.push(id, tenantId);
      await neonQuery(
        `UPDATE "Debitori" SET ${sets.join(", ")}
         WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
        params
      );
    }
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Debitore non trovato");
    return row;
  }

  async delete(_tenantSlug: string, tenantId: string, id: string) {
    await neonQuery(
      `DELETE FROM "Debitori" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
  }

  async countRecapiti(debitoreId: string, tipo?: string) {
    if (tipo) {
      const rows = await neonQuery(
        `SELECT COUNT(*)::int AS c FROM "DebitoreRecapiti"
         WHERE "DebitoreId" = $1::uuid AND "Tipo" = $2`,
        [debitoreId, tipo]
      );
      return Number((rows[0] as { c: number })?.c ?? 0);
    }
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "DebitoreRecapiti" WHERE "DebitoreId" = $1::uuid`,
      [debitoreId]
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async findFirstRecapito(filter: {
    id?: string;
    debitoreId?: string;
    tipo?: string;
  }) {
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (filter.id) {
      parts.push(`"Id" = $${i++}::uuid`);
      params.push(filter.id);
    }
    if (filter.debitoreId) {
      parts.push(`"DebitoreId" = $${i++}::uuid`);
      params.push(filter.debitoreId);
    }
    if (filter.tipo) {
      parts.push(`"Tipo" = $${i++}`);
      params.push(filter.tipo);
    }
    if (!parts.length) return null;
    const rows = await neonQuery(
      `SELECT * FROM "DebitoreRecapiti" WHERE ${parts.join(" AND ")} LIMIT 1`,
      params
    );
    return rows[0] ? mapDebitore(rows[0] as Record<string, unknown>) : null;
  }

  async createRecapito(data: RecapitoCreateInput): Promise<DebitoreDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "DebitoreRecapiti" ("Id","DebitoreId","Tipo","Valore","Ordine","Stato","CreatedAt")
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,NOW())`,
      [
        id,
        data.debitoreId,
        data.tipo,
        data.valore,
        data.ordine ?? 1,
        data.stato ?? null,
      ]
    );
    const row = await this.findFirstRecapito({ id });
    if (!row) throw new Error("Creazione recapito fallita");
    return row;
  }

  async updateRecapito(id: string, data: Record<string, unknown>): Promise<DebitoreDto> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (data.valore !== undefined) {
      sets.push(`"Valore" = $${i++}`);
      params.push(data.valore);
    }
    if (data.stato !== undefined) {
      if (data.stato == null) sets.push(`"Stato" = NULL`);
      else {
        sets.push(`"Stato" = $${i++}`);
        params.push(data.stato);
      }
    }
    if (data.ordine !== undefined) {
      sets.push(`"Ordine" = $${i++}`);
      params.push(data.ordine);
    }
    if (sets.length) {
      params.push(id);
      await neonQuery(
        `UPDATE "DebitoreRecapiti" SET ${sets.join(", ")} WHERE "Id" = $${i}::uuid`,
        params
      );
    }
    const row = await this.findFirstRecapito({ id });
    if (!row) throw new Error("Recapito non trovato");
    return row;
  }

  async deleteRecapito(id: string) {
    await neonQuery(`DELETE FROM "DebitoreRecapiti" WHERE "Id" = $1::uuid`, [id]);
  }

  async deleteRecapitiByDebitore(debitoreId: string) {
    await neonQuery(`DELETE FROM "DebitoreRecapiti" WHERE "DebitoreId" = $1::uuid`, [
      debitoreId,
    ]);
  }
}

export function createNeonDebitoriRepository(tenantSlug: string) {
  return new NeonDebitoriRepository(tenantSlug);
}
