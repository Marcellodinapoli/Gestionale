import "server-only";
import { Pool, type QueryResultRow } from "@neondatabase/serverless";
import { getNeonDatabaseUrl } from "@/lib/neon/client";

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

export async function neonQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getNeonPool().query<T>(text, params);
  return res.rows;
}
