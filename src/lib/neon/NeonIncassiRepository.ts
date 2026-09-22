import "server-only";
import type { QueryResultRow } from "@neondatabase/serverless";
import { getNeonPool, neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  AggiornaIncassoInput,
  EliminaIncassoInput,
  IncassoAggregateRequest,
  IncassoCreateInput,
  IncassoFilter,
  IncassoGroupByMetodoRequest,
  IncassoListRequest,
  IncassiRepository,
  IncassoDto,
  RegistraIncassoInput,
} from "@/lib/data/contracts/incassi";

function mapIncasso(row: Record<string, unknown>): IncassoDto {
  const mapped = mapSqlRow(row);
  for (const k of ["data", "dataScadenza", "createdAt"] as const) {
    if (typeof mapped[k] === "string") mapped[k] = new Date(String(mapped[k]));
  }
  if (row.pratica && typeof row.pratica === "object") {
    const praticaRaw = row.pratica as Record<string, unknown>;
    const pratica = mapSqlRow(praticaRaw);
    if (praticaRaw.mandante && typeof praticaRaw.mandante === "object") {
      pratica.mandante = mapSqlRow(praticaRaw.mandante as Record<string, unknown>);
    }
    if (praticaRaw.debitore && typeof praticaRaw.debitore === "object") {
      pratica.debitore = mapSqlRow(praticaRaw.debitore as Record<string, unknown>);
    }
    mapped.pratica = pratica;
  }
  if (row.user && typeof row.user === "object") {
    mapped.user = mapSqlRow(row.user as Record<string, unknown>);
  }
  return mapped;
}

function needsPraticaJoin(filter?: IncassoFilter, includeElenco?: boolean) {
  if (includeElenco) return true;
  if (!filter) return false;
  return Boolean(
    filter.mandanteId ||
      filter.numeroMandante ||
      filter.numeriMandanteIn?.length ||
      filter.sedeId ||
      filter.cittaContains ||
      filter.clienteContains ||
      filter.capDa ||
      filter.capA ||
      filter.dataAffidoGte ||
      filter.dataAffidoLte ||
      filter.dataScaricoRicevutaGte ||
      filter.dataScaricoRicevutaLte
  );
}

function needsDebitoreJoin(filter?: IncassoFilter, includeElenco?: boolean) {
  if (includeElenco) return true;
  if (!filter) return false;
  return Boolean(
    filter.cittaContains || filter.clienteContains || filter.capDa || filter.capA
  );
}

function filterSql(
  filter: IncassoFilter | undefined,
  startIdx: number,
  opts?: { includeElenco?: boolean; includePratica?: boolean }
): { sql: string; params: unknown[]; next: number; join: string } {
  if (filter?.none) {
    return { sql: " AND 1 = 0", params: [], next: startIdx, join: "" };
  }
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIdx;
  let join = "";

  if (filter?.praticaId) {
    parts.push(`i."PraticaId" = $${i++}::uuid`);
    params.push(filter.praticaId);
  }
  if (filter?.praticaIdsIn?.length) {
    parts.push(`i."PraticaId" = ANY($${i++}::uuid[])`);
    params.push(filter.praticaIdsIn);
  }
  if (filter?.userId) {
    parts.push(`i."UserId" = $${i++}::uuid`);
    params.push(filter.userId);
  }
  if (filter?.dataGte) {
    parts.push(`i."Data" >= $${i++}::timestamptz`);
    params.push(filter.dataGte);
  }
  if (filter?.dataLte) {
    parts.push(`i."Data" <= $${i++}::timestamptz`);
    params.push(filter.dataLte);
  }
  if (filter?.metodo) {
    parts.push(`i."Metodo" = $${i++}`);
    params.push(filter.metodo);
  }
  if (filter?.modo) {
    parts.push(`LOWER(TRIM(i."Modo")) = $${i++}`);
    params.push(filter.modo.toLowerCase());
  }
  if (filter?.causaleContains) {
    parts.push(`i."Causale" ILIKE $${i++}`);
    params.push(`%${filter.causaleContains}%`);
  }
  if (filter?.fatturaContains) {
    parts.push(`i."Fattura" ILIKE $${i++}`);
    params.push(`%${filter.fatturaContains}%`);
  }

  const joinPratica =
    needsPraticaJoin(filter, opts?.includeElenco) || Boolean(opts?.includePratica);
  const joinDebitore = needsDebitoreJoin(filter, opts?.includeElenco);

  if (joinPratica) {
    join = ` INNER JOIN "Pratiche" p ON p."Id" = i."PraticaId" `;
    if (filter?.mandanteId) {
      parts.push(`p."MandanteId" = $${i++}::uuid`);
      params.push(filter.mandanteId);
    }
    if (filter?.numeroMandante) {
      parts.push(`p."NumeroMandante" = $${i++}`);
      params.push(filter.numeroMandante);
    }
    if (filter?.numeriMandanteIn?.length) {
      parts.push(`p."NumeroMandante" = ANY($${i++}::text[])`);
      params.push(filter.numeriMandanteIn);
    }
    if (filter?.dataAffidoGte) {
      parts.push(`p."DataAffido" >= $${i++}::timestamptz`);
      params.push(filter.dataAffidoGte);
    }
    if (filter?.dataAffidoLte) {
      parts.push(`p."DataAffido" <= $${i++}::timestamptz`);
      params.push(filter.dataAffidoLte);
    }
    if (filter?.dataScaricoRicevutaGte) {
      parts.push(`p."CodiceScaricoAt" >= $${i++}::timestamptz`);
      params.push(filter.dataScaricoRicevutaGte);
    }
    if (filter?.dataScaricoRicevutaLte) {
      parts.push(`p."CodiceScaricoAt" <= $${i++}::timestamptz`);
      params.push(filter.dataScaricoRicevutaLte);
    }
    if (filter?.sedeId) {
      join += `
        LEFT JOIN "Users" ua ON ua."Id" = p."AssegnatarioId"
        LEFT JOIN "Users" ut ON ut."Id" = p."OperatoreTitolareId"
      `;
      parts.push(`(ua."SedeId" = $${i}::uuid OR ut."SedeId" = $${i}::uuid)`);
      params.push(filter.sedeId);
      i += 1;
    }
  }

  if (joinDebitore) {
    if (!joinPratica) {
      join = ` INNER JOIN "Pratiche" p ON p."Id" = i."PraticaId" `;
    }
    join += ` INNER JOIN "Debitori" d ON d."Id" = p."DebitoreId" `;
    if (filter?.cittaContains) {
      parts.push(`d."Citta" ILIKE $${i++}`);
      params.push(`%${filter.cittaContains}%`);
    }
    if (filter?.clienteContains) {
      parts.push(
        `(d."Nome" ILIKE $${i} OR d."Cognome" ILIKE $${i} OR (d."Cognome" || ' ' || d."Nome") ILIKE $${i} OR (d."Nome" || ' ' || d."Cognome") ILIKE $${i})`
      );
      params.push(`%${filter.clienteContains}%`);
      i += 1;
    }
    if (filter?.capDa) {
      parts.push(`d."Cap" >= $${i++}`);
      params.push(filter.capDa);
    }
    if (filter?.capA) {
      parts.push(`d."Cap" <= $${i++}`);
      params.push(filter.capA);
    }
  }

  if (opts?.includeElenco) {
    if (!join.includes('"Debitori"')) {
      if (!join.includes('"Pratiche"')) {
        join = ` INNER JOIN "Pratiche" p ON p."Id" = i."PraticaId" `;
      }
      join += ` INNER JOIN "Debitori" d ON d."Id" = p."DebitoreId" `;
    }
    join += `
      INNER JOIN "Mandanti" m ON m."Id" = p."MandanteId"
      LEFT JOIN "Users" u ON u."Id" = i."UserId"
    `;
  }

  return {
    sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    params,
    next: i,
    join,
  };
}

function toIso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

async function withTx<T>(
  fn: (q: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
): Promise<T> {
  const client = await getNeonPool().connect();
  try {
    await client.query("BEGIN");
    const q = async <R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => {
      const res = await client.query<R>(text, params);
      return res.rows;
    };
    const result = await fn(q);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export class NeonIncassiRepository implements IncassiRepository {
  constructor(private _tenantSlug: string) {}

  async list(req: IncassoListRequest): Promise<{ items: IncassoDto[]; total: number }> {
    const includeElenco = Boolean(req.includeElenco);
    const filt = filterSql(req.filter, 2, {
      includeElenco,
      includePratica: req.includePratica && !includeElenco,
    });
    const where = `i."TenantId" = $1::uuid${filt.sql}`;
    const params = [req.tenantId, ...filt.params];
    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Incassi" i ${filt.join} WHERE ${where}`,
      params
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);
    const take = req.take ?? 5000;
    const skip = req.skip ?? 0;

    let select = `i.*`;
    let join = filt.join;
    if (includeElenco) {
      select += `,
        p."Id" AS "Pratica_Id", p."Numero" AS "Pratica_Numero", p."NumeroMandante" AS "Pratica_NumeroMandante",
        p."DataAffido" AS "Pratica_DataAffido", p."CodiceScaricoAt" AS "Pratica_CodiceScaricoAt",
        p."MandanteId" AS "Pratica_MandanteId",
        m."Codice" AS "Mandante_Codice", m."RagioneSociale" AS "Mandante_RagioneSociale", m."PerimetriJson" AS "Mandante_Perimetri",
        d."Nome" AS "Debitore_Nome", d."Cognome" AS "Debitore_Cognome", d."Citta" AS "Debitore_Citta", d."Cap" AS "Debitore_Cap",
        u."Id" AS "User_Id", u."Name" AS "User_Name"`;
    } else if (req.includePratica) {
      select += `, p."MandanteId" AS "Pratica_MandanteId"`;
      if (!join.includes('"Pratiche"')) {
        join = ` INNER JOIN "Pratiche" p ON p."Id" = i."PraticaId" `;
      }
    }

    const rows = await neonQuery(
      `SELECT ${select}
       FROM "Incassi" i
       ${join}
       WHERE ${where}
       ORDER BY i."Data" DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, take, skip]
    );

    const items = rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      if (includeElenco) {
        return mapIncasso({
          Id: row.Id,
          TenantId: row.TenantId,
          PraticaId: row.PraticaId,
          UserId: row.UserId,
          Importo: row.Importo,
          Capitale: row.Capitale,
          Interessi: row.Interessi,
          Spese: row.Spese,
          SpeseRec: row.SpeseRec,
          Metodo: row.Metodo,
          Modo: row.Modo,
          Causale: row.Causale,
          Fattura: row.Fattura,
          Data: row.Data,
          DataScadenza: row.DataScadenza,
          CreatedAt: row.CreatedAt,
          pratica: {
            Id: row.Pratica_Id,
            Numero: row.Pratica_Numero,
            NumeroMandante: row.Pratica_NumeroMandante,
            DataAffido: row.Pratica_DataAffido,
            CodiceScaricoAt: row.Pratica_CodiceScaricoAt,
            MandanteId: row.Pratica_MandanteId,
            mandante: {
              Codice: row.Mandante_Codice,
              RagioneSociale: row.Mandante_RagioneSociale,
              Perimetri: row.Mandante_Perimetri,
            },
            debitore: {
              Nome: row.Debitore_Nome,
              Cognome: row.Debitore_Cognome,
              Citta: row.Debitore_Citta,
              Cap: row.Debitore_Cap,
            },
          },
          user: {
            Id: row.User_Id,
            Name: row.User_Name,
          },
        });
      }
      if (req.includePratica && row.Pratica_MandanteId != null) {
        return mapIncasso({
          ...row,
          pratica: { MandanteId: row.Pratica_MandanteId },
        });
      }
      return mapIncasso(row);
    });

    return { items, total };
  }

  async count(_tenantSlug: string, tenantId: string, filter?: IncassoFilter) {
    const filt = filterSql(filter, 2);
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Incassi" i ${filt.join}
       WHERE i."TenantId" = $1::uuid${filt.sql}`,
      [tenantId, ...filt.params]
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async aggregate(req: IncassoAggregateRequest) {
    const filt = filterSql(req.filter, 2);
    const rows = await neonQuery(
      `SELECT
         COALESCE(SUM(i."Importo"), 0)::float AS "SumImporto",
         COALESCE(SUM(i."Capitale"), 0)::float AS "SumCapitale",
         COALESCE(SUM(i."Interessi"), 0)::float AS "SumInteressi",
         COALESCE(SUM(i."Spese"), 0)::float AS "SumSpese"
       FROM "Incassi" i ${filt.join}
       WHERE i."TenantId" = $1::uuid${filt.sql}`,
      [req.tenantId, ...filt.params]
    );
    const row = (rows[0] || {}) as Record<string, number>;
    return {
      _sum: {
        importo: row.SumImporto != null ? Number(row.SumImporto) : null,
        capitale: row.SumCapitale != null ? Number(row.SumCapitale) : null,
        interessi: row.SumInteressi != null ? Number(row.SumInteressi) : null,
        spese: row.SumSpese != null ? Number(row.SumSpese) : null,
      },
    };
  }

  async groupByMetodo(req: IncassoGroupByMetodoRequest) {
    const filt = filterSql(req.filter, 2);
    const rows = await neonQuery(
      `SELECT
         i."Metodo" AS metodo,
         COALESCE(SUM(i."Importo"), 0)::float AS "sumImporto",
         COUNT(*)::int AS cnt
       FROM "Incassi" i ${filt.join}
       WHERE i."TenantId" = $1::uuid${filt.sql}
       GROUP BY i."Metodo"`,
      [req.tenantId, ...filt.params]
    );
    return rows.map((r) => ({
      metodo: String((r as { metodo: string }).metodo),
      _sum: { importo: Number((r as { sumImporto: number }).sumImporto) },
      _count: Number((r as { cnt: number }).cnt),
    }));
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    const rows = await neonQuery(
      `SELECT * FROM "Incassi"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapIncasso(rows[0] as Record<string, unknown>) : null;
  }

  async create(
    _tenantSlug: string,
    tenantId: string,
    data: IncassoCreateInput
  ): Promise<IncassoDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "Incassi" (
         "Id","TenantId","PraticaId","UserId","Importo","Capitale","Interessi","Spese","SpeseRec",
         "Metodo","Modo","Causale","Fattura","Data","DataScadenza","CreatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,
         $10,$11,$12,$13,$14::timestamptz,$15::timestamptz,NOW()
       )`,
      [
        id,
        tenantId,
        data.praticaId,
        data.userId,
        data.importo,
        data.capitale ?? 0,
        data.interessi ?? 0,
        data.spese ?? 0,
        data.speseRec ?? 0,
        data.metodo ?? "bonifico",
        data.modo ?? "VE",
        data.causale ?? "",
        data.fattura ?? "",
        toIso(data.data) ?? new Date().toISOString(),
        toIso(data.dataScadenza ?? null),
      ]
    );
    const row = await this.getById(_tenantSlug, tenantId, id);
    if (!row) throw new Error("Creazione incasso fallita");
    return row;
  }

  async registra(
    tenantSlug: string,
    tenantId: string,
    input: RegistraIncassoInput
  ): Promise<IncassoDto> {
    const id = crypto.randomUUID();
    const inc = input.incasso;
    await withTx(async (q) => {
      const pratica = await q(
        `SELECT "Id" FROM "Pratiche" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid LIMIT 1`,
        [inc.praticaId, tenantId]
      );
      if (!pratica[0]) throw new Error("Pratica non trovata");

      await q(
        `INSERT INTO "Incassi" (
           "Id","TenantId","PraticaId","UserId","Importo","Capitale","Interessi","Spese","SpeseRec",
           "Metodo","Modo","Causale","Fattura","Data","DataScadenza","CreatedAt"
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,
           $10,$11,$12,$13,$14::timestamptz,$15::timestamptz,NOW()
         )`,
        [
          id,
          tenantId,
          inc.praticaId,
          inc.userId,
          inc.importo,
          inc.capitale ?? 0,
          inc.interessi ?? 0,
          inc.spese ?? 0,
          inc.speseRec ?? 0,
          inc.metodo ?? "bonifico",
          inc.modo ?? "VE",
          inc.causale ?? "",
          inc.fattura ?? "",
          toIso(inc.data) ?? new Date().toISOString(),
          toIso(inc.dataScadenza ?? null),
        ]
      );

      if (input.provvigione) {
        const prov = input.provvigione;
        await q(
          `INSERT INTO "Provvigioni" (
             "Id","TenantId","IncassoId","PraticaId","OperatoreId",
             "BaseImporto","Percentuale","Importo","Stato","CreatedAt"
           ) VALUES (
             $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,
             $6,$7,$8,'MATURATA',NOW()
           )`,
          [
            crypto.randomUUID(),
            tenantId,
            id,
            prov.praticaId,
            prov.operatoreId,
            prov.baseImporto,
            prov.percentuale,
            prov.importo,
          ]
        );
      }

      await q(
        `UPDATE "Pratiche" SET
           "Residuo" = $1,
           "Stato" = $2,
           "TotIncassato" = (SELECT COALESCE(SUM("Importo"), 0) FROM "Incassi" WHERE "PraticaId" = $3::uuid),
           "UpdatedAt" = NOW()
         WHERE "Id" = $3::uuid`,
        [input.praticaUpdate.residuo, input.praticaUpdate.stato, inc.praticaId]
      );
    });
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Registrazione incasso fallita");
    return row;
  }

  async aggiorna(
    tenantSlug: string,
    tenantId: string,
    id: string,
    input: AggiornaIncassoInput
  ): Promise<IncassoDto> {
    await withTx(async (q) => {
      const existing = await q<{ Id: string; PraticaId: string }>(
        `SELECT "Id", "PraticaId" FROM "Incassi"
         WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid LIMIT 1`,
        [id, tenantId]
      );
      if (!existing[0]) throw new Error("Incasso non trovato");
      const praticaId = String(existing[0].PraticaId);
      const inc = input.incasso;

      await q(
        `UPDATE "Incassi" SET
           "Importo" = $1, "Capitale" = $2, "Interessi" = $3, "Spese" = $4, "SpeseRec" = $5,
           "Metodo" = $6, "Modo" = $7, "Causale" = $8, "Fattura" = $9,
           "Data" = $10::timestamptz, "DataScadenza" = $11::timestamptz
         WHERE "Id" = $12::uuid`,
        [
          inc.importo,
          inc.capitale ?? 0,
          inc.interessi ?? 0,
          inc.spese ?? 0,
          inc.speseRec ?? 0,
          inc.metodo ?? "bonifico",
          inc.modo ?? "ve",
          inc.causale ?? "",
          inc.fattura ?? "",
          toIso(inc.data) ?? new Date().toISOString(),
          toIso(inc.dataScadenza ?? null),
          id,
        ]
      );

      await q(`DELETE FROM "Provvigioni" WHERE "IncassoId" = $1::uuid`, [id]);

      if (input.provvigione) {
        const prov = input.provvigione;
        await q(
          `INSERT INTO "Provvigioni" (
             "Id","TenantId","IncassoId","PraticaId","OperatoreId",
             "BaseImporto","Percentuale","Importo","Stato","CreatedAt"
           ) VALUES (
             $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,
             $6,$7,$8,'MATURATA',NOW()
           )`,
          [
            crypto.randomUUID(),
            tenantId,
            id,
            prov.praticaId,
            prov.operatoreId,
            prov.baseImporto,
            prov.percentuale,
            prov.importo,
          ]
        );
      }

      await q(
        `UPDATE "Pratiche" SET
           "Residuo" = $1,
           "Stato" = $2,
           "TotIncassato" = (SELECT COALESCE(SUM("Importo"), 0) FROM "Incassi" WHERE "PraticaId" = $3::uuid),
           "UpdatedAt" = NOW()
         WHERE "Id" = $3::uuid`,
        [input.praticaUpdate.residuo, input.praticaUpdate.stato, praticaId]
      );
    });
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Incasso non trovato");
    return row;
  }

  async elimina(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    input: EliminaIncassoInput
  ) {
    await withTx(async (q) => {
      const existing = await q<{ Id: string; PraticaId: string }>(
        `SELECT "Id", "PraticaId" FROM "Incassi"
         WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid LIMIT 1`,
        [id, tenantId]
      );
      if (!existing[0]) throw new Error("Incasso non trovato");
      const praticaId = String(existing[0].PraticaId);

      await q(`DELETE FROM "Provvigioni" WHERE "IncassoId" = $1::uuid`, [id]);
      await q(`DELETE FROM "Incassi" WHERE "Id" = $1::uuid`, [id]);
      await q(
        `UPDATE "Pratiche" SET
           "Residuo" = $1,
           "Stato" = $2,
           "TotIncassato" = (SELECT COALESCE(SUM("Importo"), 0) FROM "Incassi" WHERE "PraticaId" = $3::uuid),
           "UpdatedAt" = NOW()
         WHERE "Id" = $3::uuid`,
        [input.praticaUpdate.residuo, input.praticaUpdate.stato, praticaId]
      );
    });
    return { ok: true };
  }
}

export function createNeonIncassiRepository(tenantSlug: string) {
  return new NeonIncassiRepository(tenantSlug);
}
