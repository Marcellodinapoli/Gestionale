import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(".env") });
process.env.DATABASE_PROVIDER = "neon";

const { listOfferteLavoro } = await import("../src/lib/recruiting/offerteRepo.ts");
const { neonQuery } = await import("../src/lib/neon/pool.ts");

const tenants = await neonQuery(`SELECT "Id", "Slug" FROM "Tenants" LIMIT 1`);
const tid = String(tenants[0].Id);
console.log("tenant", tid, tenants[0].Slug);
const offerte = await listOfferteLavoro(tid);
console.log("offerte", offerte.length, offerte.map((o) => o.titolo));
