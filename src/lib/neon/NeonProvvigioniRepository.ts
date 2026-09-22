import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  ProvvigioneAggregateRequest,
  ProvvigioneFilter,
  ProvvigioneGroupByRequest,
  ProvvigioneListRequest,
  ProvvigioneUpdateInput,
  ProvvigioniRepository,
} from "@/lib/data/contracts/provvigioni";

function filterSql(
  filter: ProvvigioneFilter | undefined,
  tenantId: string,
  startIdx = 1
): { sql: string; params: unknown[]; next: number; join: string } {
  if (filter?.none) {
    return { sql: " AND 1 = 0", params: [tenantId], next: startIdx + 1, join: "" };
  }
  const parts: string[] = [`pv."TenantId" = $${startIdx}::uuid`];
  const params: unknown[] = [tenantId];
  let i = startIdx + 1;
  let join = "";

  if (filter?.id) {
    parts.push(`pv."Id" = $${i++}::uuid`);
    params.push(filter.id);
  }
  if (filter?.idsIn?.length) {
    parts.push(`pv."Id" = ANY($${i++}::uuid[])`);
    params.push(filter.idsIn);
  }
  if (filter?.praticaId) {
    parts.push(`pv."PraticaId" = $${i++}::uuid`);
    params.push(filter.praticaId);
  }
  if (filter?.operatoreId) {
    parts.push(`pv."OperatoreId" = $${i++}::uuid`);
    params.push(filter.operatoreId);
  }
  if (filter?.operatoreIdIn?.length) {
    parts.push(`pv."OperatoreId" = ANY($${i++}::uuid[])`);
    params.push(filter.operatoreIdIn);
  }
  if (filter?.stato) {
    parts.push(`pv."Stato" = $${i++}`);
    params.push(filter.stato);
  }
  if (filter?.createdAtGte) {
    parts.push(`pv."CreatedAt" >= $${i++}::timestamptz`);
    params.push(filter.createdAtGte);
  }
  if (filter?.createdAtLte) {
    parts.push(`pv."CreatedAt" <= $${i++}::timestamptz`);
    params.push(filter.createdAtLte);
  }

  if (filter?.operatoreSedeId || filter?.operatoreOrSupervisorId) {
    join += ` INNER JOIN "Users" u ON u."Id" = pv."OperatoreId" `;
    if (filter.operatoreSedeId) {
      parts.push(`u."SedeId" = $${i++}::uuid`);
      params.push(filter.operatoreSedeId);
    }
    if (filter.operatoreOrSupervisorId) {
      parts.push(`(u."Id" = $${i}::uuid OR u."SupervisorId" = $${i}::uuid)`);
      params.push(filter.operatoreOrSupervisorId);
      i += 1;
    }
  }

  const needsPratica =
    filter?.praticaMandanteId ||
    filter?.praticaNumeroMandante ||
    filter?.praticaNumeroMandanteNull ||
    filter?.perimetroOr?.length;
  if (needsPratica) {
    join += ` INNER JOIN "Pratiche" p ON p."Id" = pv."PraticaId" `;
    if (filter?.praticaMandanteId) {
      parts.push(`p."MandanteId" = $${i++}::uuid`);
      params.push(filter.praticaMandanteId);
    }
    if (filter?.praticaNumeroMandante) {
      parts.push(`p."NumeroMandante" = $${i++}`);
      params.push(filter.praticaNumeroMandante);
    }
    if (filter?.praticaNumeroMandanteNull) {
      parts.push(`(p."NumeroMandante" IS NULL OR p."NumeroMandante" = '')`);
    }
    if (filter?.perimetroOr?.length) {
      const orParts: string[] = [];
      for (const pair of filter.perimetroOr) {
        if (pair.numeriMandante?.length) {
          orParts.push(
            `(p."MandanteId" = $${i}::uuid AND p."NumeroMandante" = ANY($${i + 1}::text[]))`
          );
          params.push(pair.mandanteId, pair.numeriMandante);
          i += 2;
        } else {
          orParts.push(`p."MandanteId" = $${i++}::uuid`);
          params.push(pair.mandanteId);
        }
      }
      if (orParts.length) parts.push(`(${orParts.join(" OR ")})`);
    }
  }

  return {
    sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
    params,
    next: i,
    join,
  };
}

function mapListItem(
  row: Record<string, unknown>,
  opts: {
    includeOperatore?: boolean;
    includePraticaDebitore?: boolean;
    includeIncasso?: boolean;
  }
) {
  const out = mapSqlRow(row);
  for (const k of ["baseImporto", "percentuale", "importo"] as const) {
    if (out[k] != null && typeof out[k] !== "number") {
      out[k] = Number(out[k]);
    }
  }
  if (opts.includeOperatore && row.Operatore_Name != null) {
    out.operatore = { name: row.Operatore_Name, Name: row.Operatore_Name };
  }
  if (opts.includePraticaDebitore) {
    out.pratica = {
      numero: row.Pratica_Numero,
      numeroMandante: row.Pratica_NumeroMandante,
      stato: row.Pratica_Stato,
      codiceScarico: row.Pratica_CodiceScarico,
      mandanteId: row.Pratica_MandanteId,
      debitore: { nome: row.Debitore_Nome, cognome: row.Debitore_Cognome },
      mandante: {
        codice: row.Mandante_Codice,
        perimetri: row.Mandante_Perimetri,
      },
    };
  }
  if (opts.includeIncasso) {
    const importo =
      row.Incasso_Importo != null ? Number(row.Incasso_Importo) : null;
    out.incasso = {
      data: row.Incasso_Data,
      importo,
      metodo: row.Incasso_Metodo,
      fattura: row.Incasso_Fattura,
      modo: row.Incasso_Modo,
    };
  }
  for (const k of ["createdAt", "liquidataAt"] as const) {
    if (typeof out[k] === "string") out[k] = new Date(String(out[k]));
  }
  return out;
}

export class NeonProvvigioniRepository implements ProvvigioniRepository {
  constructor(private _tenantSlug: string) {}

  async list(req: ProvvigioneListRequest) {
    const filt = filterSql(req.filter, req.tenantId);
    const take = req.take ?? 5000;
    const skip = req.skip ?? 0;

    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Provvigioni" pv ${filt.join}${filt.sql}`,
      filt.params
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);

    let join = filt.join;
    let select = `pv.*`;
    if (req.includeOperatore) {
      if (!join.includes('"Users" u')) {
        join += ` LEFT JOIN "Users" u ON u."Id" = pv."OperatoreId" `;
      }
      select += `, u."Name" AS "Operatore_Name"`;
    }
    if (req.includePraticaDebitore) {
      if (!join.includes('"Pratiche" p')) {
        join += ` INNER JOIN "Pratiche" p ON p."Id" = pv."PraticaId" `;
      }
      join += ` INNER JOIN "Debitori" d ON d."Id" = p."DebitoreId" `;
      join += ` LEFT JOIN "Mandanti" man ON man."Id" = p."MandanteId" `;
      select += `,
        p."Numero" AS "Pratica_Numero", p."NumeroMandante" AS "Pratica_NumeroMandante",
        p."Stato" AS "Pratica_Stato", p."CodiceScarico" AS "Pratica_CodiceScarico",
        p."MandanteId" AS "Pratica_MandanteId",
        d."Nome" AS "Debitore_Nome", d."Cognome" AS "Debitore_Cognome",
        man."Codice" AS "Mandante_Codice", man."PerimetriJson" AS "Mandante_Perimetri"`;
    }
    if (req.includeIncasso) {
      join += ` INNER JOIN "Incassi" inc ON inc."Id" = pv."IncassoId" `;
      select += `,
        inc."Data" AS "Incasso_Data", inc."Importo" AS "Incasso_Importo",
        inc."Metodo" AS "Incasso_Metodo", inc."Fattura" AS "Incasso_Fattura",
        inc."Modo" AS "Incasso_Modo"`;
    }

    const rows = await neonQuery(
      `SELECT ${select}
       FROM "Provvigioni" pv
       ${join}
       ${filt.sql}
       ORDER BY pv."CreatedAt" DESC
       LIMIT $${filt.params.length + 1} OFFSET $${filt.params.length + 2}`,
      [...filt.params, take, skip]
    );

    return {
      items: rows.map((r) =>
        mapListItem(r as Record<string, unknown>, {
          includeOperatore: req.includeOperatore,
          includePraticaDebitore: req.includePraticaDebitore,
          includeIncasso: req.includeIncasso,
        })
      ),
      total,
    };
  }

  async aggregate(req: ProvvigioneAggregateRequest) {
    const filt = filterSql(req.filter, req.tenantId);
    const rows = await neonQuery(
      `SELECT COALESCE(SUM(pv."Importo"), 0)::float AS importo_sum, COUNT(*)::int AS cnt
       FROM "Provvigioni" pv ${filt.join}${filt.sql}`,
      filt.params
    );
    const row = (rows[0] || {}) as { importo_sum?: number; cnt?: number };
    return {
      _sum: { importo: Number(row.importo_sum ?? 0) },
      _count: Number(row.cnt ?? 0),
    };
  }

  async groupBy(req: ProvvigioneGroupByRequest) {
    const filt = filterSql(req.filter, req.tenantId);
    const cols = req.by
      .map((b) => (b === "operatoreId" ? `pv."OperatoreId"` : `pv."Stato"`))
      .join(", ");
    if (!cols) return [];
    const rows = await neonQuery(
      `SELECT ${cols},
         COALESCE(SUM(pv."Importo"), 0)::float AS importo_sum,
         COUNT(*)::int AS cnt
       FROM "Provvigioni" pv ${filt.join}${filt.sql}
       GROUP BY ${cols}`,
      filt.params
    );
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        operatoreId: req.by.includes("operatoreId")
          ? String(row.OperatoreId ?? "")
          : undefined,
        stato: req.by.includes("stato") ? String(row.Stato ?? "") : undefined,
        _sum: { importo: Number(row.importo_sum ?? 0) },
        _count: Number(row.cnt ?? 0),
      };
    });
  }

  async update(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    data: ProvvigioneUpdateInput
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (data.stato !== undefined) {
      sets.push(`"Stato" = $${i++}`);
      params.push(data.stato);
    }
    if (data.importo !== undefined) {
      sets.push(`"Importo" = $${i++}`);
      params.push(data.importo);
    }
    if (data.percentuale !== undefined) {
      sets.push(`"Percentuale" = $${i++}`);
      params.push(data.percentuale);
    }
    if (data.liquidataAt !== undefined) {
      sets.push(`"LiquidataAt" = $${i++}::timestamptz`);
      params.push(
        data.liquidataAt
          ? data.liquidataAt instanceof Date
            ? data.liquidataAt.toISOString()
            : String(data.liquidataAt)
          : null
      );
    }
    if (!sets.length) {
      const cur = await neonQuery(
        `SELECT * FROM "Provvigioni" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
        [id, tenantId]
      );
      return mapSqlRow((cur[0] || {}) as Record<string, unknown>);
    }
    params.push(id, tenantId);
    const rows = await neonQuery(
      `UPDATE "Provvigioni" SET ${sets.join(", ")}
       WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid
       RETURNING *`,
      params
    );
    return mapSqlRow((rows[0] || {}) as Record<string, unknown>);
  }

  async updateMany(
    _tenantSlug: string,
    tenantId: string,
    filter: ProvvigioneFilter | undefined,
    data: ProvvigioneUpdateInput
  ) {
    const filt = filterSql(filter, tenantId);
    const sets: string[] = [];
    const params = [...filt.params];
    let i = filt.next;
    if (data.stato !== undefined) {
      sets.push(`"Stato" = $${i++}`);
      params.push(data.stato);
    }
    if (data.importo !== undefined) {
      sets.push(`"Importo" = $${i++}`);
      params.push(data.importo);
    }
    if (data.percentuale !== undefined) {
      sets.push(`"Percentuale" = $${i++}`);
      params.push(data.percentuale);
    }
    if (data.liquidataAt !== undefined) {
      sets.push(`"LiquidataAt" = $${i++}::timestamptz`);
      params.push(
        data.liquidataAt
          ? data.liquidataAt instanceof Date
            ? data.liquidataAt.toISOString()
            : String(data.liquidataAt)
          : null
      );
    }
    if (!sets.length) return { count: 0 };
    const rows = await neonQuery(
      `UPDATE "Provvigioni" pv SET ${sets.join(", ")}
       FROM (SELECT pv2."Id" FROM "Provvigioni" pv2 ${filt.join}${filt.sql}) AS t
       WHERE pv."Id" = t."Id"
       RETURNING pv."Id"`,
      params
    );
    return { count: rows.length };
  }

  async deleteMany(
    _tenantSlug: string,
    tenantId: string,
    filter: ProvvigioneFilter | undefined
  ) {
    const filt = filterSql(filter, tenantId);
    const rows = await neonQuery(
      `DELETE FROM "Provvigioni" pv
       USING (SELECT pv2."Id" FROM "Provvigioni" pv2 ${filt.join}${filt.sql}) AS t
       WHERE pv."Id" = t."Id"
       RETURNING pv."Id"`,
      filt.params
    );
    return { count: rows.length };
  }
}

export function createNeonProvvigioniRepository(tenantSlug: string) {
  return new NeonProvvigioniRepository(tenantSlug);
}
