/**
 * Verifica connessione a Neon (Postgres). Non tocca SQL Server né Firebase.
 *
 * Uso:
 *   1. In Neon console → progetto Credixa-Test → Connection details
 *   2. Copia la stringa (pooled / neon-js) in .env come NEON_DATABASE_URL=...
 *   3. npm run neon:ping
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });

const url = (
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL_NEON ||
  ""
).trim();

if (!url) {
  console.error(
    "NEON_DATABASE_URL mancante.\n" +
      "Apri https://console.neon.tech → Credixa-Test → Connection details\n" +
      "e aggiungi in .env:\n" +
      '  NEON_DATABASE_URL="postgresql://...@....neon.tech/neondb?sslmode=require"'
  );
  process.exit(1);
}

if (url.startsWith("file:")) {
  console.error("NEON_DATABASE_URL punta a un file SQLite locale — usa la stringa Postgres di Neon.");
  process.exit(1);
}

try {
  const sql = neon(url);
  const rows = await sql`select current_database() as db, version() as version`;
  const row = rows[0] || {};
  console.log("Neon OK");
  console.log("  database:", row.db);
  console.log("  version: ", String(row.version || "").split("\n")[0]);
  console.log("Formazione: resta su Firebase (non coinvolta).");
  console.log("SQL Server locale: non toccato.");
} catch (err) {
  console.error("Neon FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
}
