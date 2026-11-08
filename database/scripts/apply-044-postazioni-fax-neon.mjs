/**
 * Aggiunge NumeroFax e NumeroWhatsapp su Neon (migration 044).
 * Uso: node database/scripts/apply-044-postazioni-fax-neon.mjs
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
  console.error("NEON_DATABASE_URL mancante in .env");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE "Postazioni" ADD COLUMN IF NOT EXISTS "NumeroFax" VARCHAR(30)`;
await sql`ALTER TABLE "Postazioni" ADD COLUMN IF NOT EXISTS "NumeroWhatsapp" VARCHAR(30)`;

const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Postazioni'
    AND column_name IN ('NumeroFax', 'NumeroWhatsapp')
  ORDER BY column_name
`;

console.log(
  "Migration 044 (Neon) OK — colonne:",
  cols.map((c) => c.column_name).join(", ") || "(nessuna)"
);
