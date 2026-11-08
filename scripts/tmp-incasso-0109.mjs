import { config } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
const sql = neon(process.env.NEON_DATABASE_URL.trim());

const pinco = "33d95505-ada4-f111-92c8-0c7a1586d1ba";

const incassi = await sql`
  SELECT i."Id", i."Data", i."Importo", i."Metodo", i."Modo", i."CreatedAt",
         pv."Id" AS prov_id, pv."Importo" AS prov_importo, pv."CreatedAt" AS prov_created
  FROM "Incassi" i
  LEFT JOIN "Provvigioni" pv ON pv."IncassoId" = i."Id"
  INNER JOIN "Pratiche" pr ON pr."Id" = i."PraticaId"
  WHERE pv."OperatoreId" = ${pinco}::uuid OR i."UserId" = ${pinco}::uuid
  ORDER BY i."Data" DESC
  LIMIT 20
`;

const sept = await sql`
  SELECT i."Id", i."Data", i."Importo", i."Metodo",
         pv."Id" AS prov_id, pv."Importo" AS prov_importo, pv."OperatoreId",
         pr."AssegnatarioId"
  FROM "Incassi" i
  LEFT JOIN "Provvigioni" pv ON pv."IncassoId" = i."Id"
  INNER JOIN "Pratiche" pr ON pr."Id" = i."PraticaId"
  WHERE (pv."OperatoreId" = ${pinco}::uuid OR pr."AssegnatarioId" = ${pinco}::uuid)
    AND i."Data" >= '2026-09-01'::timestamptz
    AND i."Data" < '2026-10-01'::timestamptz
  ORDER BY i."Data"
`;

console.log("SEPT_INCASSI_PINCO", JSON.stringify(sept, null, 2));

const bon270 = await sql`
  SELECT i."Id", i."Data", i."Importo", i."Metodo", i."Capitale",
         pv."Id" AS prov_id, pv."Importo" AS prov_importo, pv."OperatoreId",
         pr."Numero", pr."AssegnatarioId"
  FROM "Incassi" i
  LEFT JOIN "Provvigioni" pv ON pv."IncassoId" = i."Id"
  INNER JOIN "Pratiche" pr ON pr."Id" = i."PraticaId"
  WHERE i."Importo" = 270.84
  ORDER BY i."Data" DESC
  LIMIT 5
`;
console.log("INCASSO_270", JSON.stringify(bon270, null, 2));

const prov270 = await sql`
  SELECT pv.*, i."Data" AS inc_data, i."Importo"
  FROM "Provvigioni" pv
  INNER JOIN "Incassi" i ON i."Id" = pv."IncassoId"
  WHERE pv."OperatoreId" = ${pinco}::uuid AND pv."Importo" = 27.08
`;
console.log("PROV_27", JSON.stringify(prov270, null, 2));

const pr = await sql`
  SELECT "Id", "Numero", "AssegnatarioId", "Stato"
  FROM "Pratiche" WHERE "Numero" = 'PRC-2026-0001' LIMIT 1
`;
console.log("PRATICA", pr);
if (pr[0]) {
  const all = await sql`
    SELECT i."Id", i."Data", i."Importo", i."UserId", pv."Id" AS pv, pv."OperatoreId", pv."Importo" AS pimp
    FROM "Incassi" i
    LEFT JOIN "Provvigioni" pv ON pv."IncassoId" = i."Id"
    WHERE i."PraticaId" = ${pr[0].Id}::uuid
    ORDER BY i."Data"
  `;
  const all2 = await sql`
    SELECT i."Id", i."Data", i."Importo", i."CreatedAt",
           pv."Id" AS pv
    FROM "Incassi" i
    LEFT JOIN "Provvigioni" pv ON pv."IncassoId" = i."Id"
    WHERE i."PraticaId" = ${pr[0].Id}::uuid
    ORDER BY i."CreatedAt"
  `;
  console.log("ALL_INCASSI_TIMESTAMPS", JSON.stringify(all2, null, 2));
}
