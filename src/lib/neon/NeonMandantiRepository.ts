import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  MandanteCreateInput,
  MandanteFilter,
  MandanteListRequest,
  MandanteUpdateInput,
  MandantiRepository,
  MandanteDto,
} from "@/lib/data/contracts/mandanti";

function mapMandante(row: Record<string, unknown>): MandanteDto {
  return mapSqlRow(row);
}

function filterSql(
  filter: MandanteFilter | undefined,
  startIdx: number
): { sql: string; params: unknown[]; next: number } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIdx;
  const ids = filter?.ids ?? filter?.idsIn;
  if (ids?.length === 1) {
    parts.push(`m."Id" = $${i++}::uuid`);
    params.push(ids[0]);
  } else if (ids?.length) {
    parts.push(`m."Id" = ANY($${i++}::uuid[])`);
    params.push(ids);
  }
  if (filter?.codice) {
    parts.push(`m."Codice" = $${i++}`);
    params.push(filter.codice);
  }
  if (filter?.q?.trim()) {
    parts.push(`(m."Codice" ILIKE $${i} OR m."RagioneSociale" ILIKE $${i})`);
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
  codice: "Codice",
  ragioneSociale: "RagioneSociale",
  email: "Email",
  telefono: "Telefono",
  referente: "Referente",
  referenteTelefono: "ReferenteTelefono",
  referenteEmail: "ReferenteEmail",
  pec: "Pec",
  indirizzo: "Indirizzo",
  citta: "Citta",
  cap: "Cap",
  provincia: "Provincia",
  provvigionePerc: "ProvvigionePerc",
  provvigioniMetodo: "ProvvigioniMetodoJson",
  incentivoTipo: "IncentivoTipo",
  incentivoValore: "IncentivoValore",
  incentivoSoglia: "IncentivoSoglia",
  incentivoNote: "IncentivoNote",
  codiciScarico: "CodiciScaricoJson",
  smsPreimpostati: "SmsPreimpostatiJson",
  perimetri: "PerimetriJson",
};

export class NeonMandantiRepository implements MandantiRepository {
  constructor(private _tenantSlug: string) {}

  async list(req: MandanteListRequest): Promise<{ items: MandanteDto[]; total: number }> {
    const filt = filterSql(req.filter, 2);
    const where = `m."TenantId" = $1::uuid${filt.sql}`;
    const params = [req.tenantId, ...filt.params];
    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Mandanti" m WHERE ${where}`,
      params
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);
    const orderCol =
      req.orderBy?.ragioneSociale != null ? `m."RagioneSociale"` : `m."Codice"`;
    const orderDir =
      (req.orderBy?.ragioneSociale ?? req.orderBy?.codice) === "desc" ? "DESC" : "ASC";
    const take = req.take ?? 500;
    const skip = req.skip ?? 0;
    const countJoin = req.includePraticaCount
      ? `, (SELECT COUNT(*)::int FROM "Pratiche" p WHERE p."MandanteId" = m."Id" AND p."TenantId" = m."TenantId") AS "PraticaCount"`
      : "";
    const rows = await neonQuery(
      `SELECT m.*${countJoin}
       FROM "Mandanti" m
       WHERE ${where}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, take, skip]
    );
    return { items: rows.map((r) => mapMandante(r as Record<string, unknown>)), total };
  }

  async count(_tenantSlug: string, tenantId: string, filter?: MandanteFilter) {
    const filt = filterSql(filter, 2);
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Mandanti" m WHERE m."TenantId" = $1::uuid${filt.sql}`,
      [tenantId, ...filt.params]
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async getById(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    includePraticaCount?: boolean
  ) {
    const countJoin = includePraticaCount
      ? `, (SELECT COUNT(*)::int FROM "Pratiche" p WHERE p."MandanteId" = m."Id" AND p."TenantId" = m."TenantId") AS "PraticaCount"`
      : "";
    const rows = await neonQuery(
      `SELECT m.*${countJoin}
       FROM "Mandanti" m
       WHERE m."Id" = $1::uuid AND m."TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapMandante(rows[0] as Record<string, unknown>) : null;
  }

  async create(_tenantSlug: string, data: MandanteCreateInput): Promise<MandanteDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "Mandanti" (
         "Id","TenantId","Codice","RagioneSociale","Email","Telefono",
         "Referente","ReferenteTelefono","ReferenteEmail","Pec",
         "Indirizzo","Citta","Cap","Provincia",
         "ProvvigionePerc","ProvvigioniMetodoJson","IncentivoTipo",
         "IncentivoValore","IncentivoSoglia","IncentivoNote",
         "CodiciScaricoJson","SmsPreimpostatiJson","PerimetriJson","CreatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,$3,$4,$5,$6,
         $7,$8,$9,$10,
         $11,$12,$13,$14,
         $15,$16,$17,
         $18,$19,$20,
         $21,$22,$23,NOW()
       )`,
      [
        id,
        data.tenantId,
        data.codice,
        data.ragioneSociale,
        data.email ?? null,
        data.telefono ?? null,
        data.referente ?? null,
        data.referenteTelefono ?? null,
        data.referenteEmail ?? null,
        data.pec ?? null,
        data.indirizzo ?? null,
        data.citta ?? null,
        data.cap ?? null,
        data.provincia ?? null,
        data.provvigionePerc ?? null,
        data.provvigioniMetodo ?? null,
        data.incentivoTipo ?? null,
        data.incentivoValore ?? null,
        data.incentivoSoglia ?? null,
        data.incentivoNote ?? null,
        data.codiciScarico ?? null,
        data.smsPreimpostati ?? null,
        data.perimetri ?? null,
      ]
    );
    const row = await this.getById(_tenantSlug, data.tenantId, id);
    if (!row) throw new Error("Creazione mandante fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: MandanteUpdateInput
  ): Promise<MandanteDto> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      if (key === "codice") continue;
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
        `UPDATE "Mandanti" SET ${sets.join(", ")}
         WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
        params
      );
    }
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Mandante non trovato");
    return row;
  }

  async delete(_tenantSlug: string, tenantId: string, id: string) {
    const linked = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Pratiche"
       WHERE "MandanteId" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
    const count = Number((linked[0] as { c: number })?.c ?? 0);
    if (count > 0) {
      throw new Error(`Impossibile eliminare: ${count} pratiche collegate`);
    }
    await neonQuery(
      `DELETE FROM "Mandanti" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
  }
}

export function createNeonMandantiRepository(tenantSlug: string) {
  return new NeonMandantiRepository(tenantSlug);
}
