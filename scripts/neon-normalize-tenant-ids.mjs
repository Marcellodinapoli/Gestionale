import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";

config({ path: resolve(".env") });

const c = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const tables = [
  "OfferteLavoro",
  "RecruitingCandidature",
  "RecruitingAttivita",
  "RecruitingColloqui",
  "RecruitingReceiverConfig",
  "DialerCampagne",
  "DialerCampagnaOperatori",
  "DialerCampagnaPratiche",
  "DialerChiamataEventi",
];

for (const t of tables) {
  try {
    const r = await c.query(
      `UPDATE "${t}" SET "TenantId" = lower("TenantId") WHERE "TenantId" <> lower("TenantId")`
    );
    console.log(t, "normalized", r.rowCount);
  } catch (e) {
    console.log(t, "skip", e instanceof Error ? e.message : e);
  }
}

const tid = (await c.query(`SELECT "Id" FROM "Tenants" LIMIT 1`)).rows[0].Id;
const o = await c.query(
  `SELECT count(*)::int AS n FROM "OfferteLavoro" WHERE "TenantId" = $1`,
  [tid]
);
console.log("offerte for tenant", tid, o.rows[0].n);
await c.end();
