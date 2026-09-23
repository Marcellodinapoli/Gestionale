import "server-only";
import { Pool, type QueryResultRow } from "@neondatabase/serverless";
import { getNeonDatabaseUrl, getNeonSql } from "@/lib/neon/client";

let pool: Pool | null = null;

export function getNeonPool(): Pool {
  const url = getNeonDatabaseUrl();
  if (!url) {
    throw new Error("NEON_DATABASE_URL non configurato");
  }
  if (!pool) {
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

function placeholderCount(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\$(\d+)/g)) {
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  return max;
}

function rowsFromUnknown<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: T[] }).rows;
  }
  return [];
}

/**
 * Query Neon via HTTP (adatto a Netlify). Non passa parametri in più rispetto
 * ai `$n` della SQL: altrimenti Postgres risponde
 * `bindmessage supplies N parameter, but prepared statement "" requires 0`.
 */
export async function neonQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const n = placeholderCount(text);
  const values = n === 0 ? undefined : params.slice(0, n);
  const sql = getNeonSql();
  if (typeof sql.query === "function") {
    const raw = values === undefined ? await sql.query(text) : await sql.query(text, values);
    return rowsFromUnknown<T>(raw);
  }
  const res =
    values === undefined
      ? await getNeonPool().query<T>(text)
      : await getNeonPool().query<T>(text, values);
  return res.rows;
}
