import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Postgres cloud (Neon) per dati operativi Credixa su Netlify.
 * Formazione resta sempre su Firebase — non usare questo client lì.
 */

export function getNeonDatabaseUrl(): string | undefined {
  const url = (
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL_NEON ||
    ""
  ).trim();
  return url || undefined;
}

export function isNeonConfigured(): boolean {
  return Boolean(getNeonDatabaseUrl());
}

let cached: NeonQueryFunction<false, false> | null = null;

/** Client SQL tagged-template per Neon (serverless / Netlify). */
export function getNeonSql(): NeonQueryFunction<false, false> {
  const url = getNeonDatabaseUrl();
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL non configurato. Copia la connection string da Neon → Credixa-Test → Connection details."
    );
  }
  if (!cached) {
    cached = neon(url);
  }
  return cached;
}

/** Verifica connettività: SELECT 1. */
export async function pingNeon(): Promise<{ ok: true; version: string }> {
  const sql = getNeonSql();
  const rows = await sql`select version() as version`;
  const version = String((rows[0] as { version?: string })?.version || "");
  return { ok: true, version };
}
