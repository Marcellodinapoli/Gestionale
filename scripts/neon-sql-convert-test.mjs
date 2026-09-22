import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";

config({ path: resolve(".env") });

// Inline copy of converter logic for smoke test
function tsqlRecruitingToPg(tsql, inputs) {
  let text = tsql;
  const values = [];
  const names = Object.keys(inputs);
  const paramIndex = new Map();
  for (const name of names) {
    values.push(inputs[name]);
    paramIndex.set(name, values.length);
  }
  const p = (name) => `$${paramIndex.get(name)}`;
  let limitSuffix = "";
  const topParam = text.match(/SELECT\s+TOP\s*\(\s*@(\w+)\s*\)\s+/i);
  const topNumParen = text.match(/SELECT\s+TOP\s*\(\s*(\d+)\s*\)\s+/i);
  const topNum = text.match(/SELECT\s+TOP\s+(\d+)\s+/i);
  if (topParam) {
    limitSuffix = ` LIMIT ${p(topParam[1])}`;
    text = text.replace(/SELECT\s+TOP\s*\(\s*@\w+\s*\)\s+/i, "SELECT ");
  } else if (topNumParen) {
    limitSuffix = ` LIMIT ${topNumParen[1]}`;
    text = text.replace(/SELECT\s+TOP\s*\(\s*\d+\s*\)\s+/i, "SELECT ");
  } else if (topNum) {
    limitSuffix = ` LIMIT ${topNum[1]}`;
    text = text.replace(/SELECT\s+TOP\s+\d+\s+/i, "SELECT ");
  }
  text = text.replace(/\bdbo\./gi, "");
  text = text.replace(/\[([^\]]+)\]/g, '"$1"');
  text = text.replace(/CONVERT\s*\(\s*NVARCHAR\s*\(\s*\d+\s*\)\s*,\s*([^)]+)\)/gi, "($1)::text");
  text = text.replace(/GETUTCDATE\(\)/gi, "(NOW() AT TIME ZONE 'utc')");
  text = text.replace(
    /\b(OfferteLavoro|RecruitingCandidature|RecruitingAttivita|RecruitingColloqui|RecruitingReceiverConfig|Users|Tenants)\b/g,
    '"$1"'
  );
  text = text.replace(/\.([A-Z][A-Za-z0-9]*)\b/g, '."$1"');
  text = text.replace(
    /(?<![."\w])(Id|TenantId|Titolo|Luogo|Stato|ScheduledAt|CandidaturaId|Round|Modalita|IntervistatoreUserId|IntervistatoreLabel|NotePreliminari|NoteSvolgimento|Esito|Valutazione|ValutazioneStelle|CreatedAt|UpdatedAt|CreatedById|Name|Cognome|OffertaId|OffertaTitolo|IntervistatoreName|IntervistatoreCognome)\b/g,
    '"$1"'
  );
  for (const name of names) {
    text = text.replace(new RegExp(`@${name}\\b`, "g"), p(name));
  }
  if (limitSuffix && !/\bLIMIT\b/i.test(text)) text = text.trim() + limitSuffix;
  return { text, values };
}

const tid = "2d9a1e28-cbe7-40b8-8d15-7807c28dc56f";
const tsql = `
      SELECT TOP (@take)
        c.Id, c.TenantId, c.CandidaturaId, c.Round, c.Stato, c.ScheduledAt, c.Modalita,
        c.IntervistatoreUserId, c.IntervistatoreLabel, c.NotePreliminari, c.NoteSvolgimento,
        c.Esito, c.Valutazione, c.ValutazioneStelle, c.CreatedAt, c.UpdatedAt, c.CreatedById,
        u.Name AS IntervistatoreName, u.Cognome AS IntervistatoreCognome,
        cand.OffertaId AS OffertaId, o.Titolo AS OffertaTitolo
      FROM dbo.RecruitingColloqui c
      INNER JOIN dbo.RecruitingCandidature cand ON cand.Id = c.CandidaturaId AND cand.TenantId = c.TenantId
      INNER JOIN dbo.OfferteLavoro o ON o.Id = cand.OffertaId AND o.TenantId = c.TenantId
      LEFT JOIN dbo.Users u ON CONVERT(NVARCHAR(64), u.Id) = c.IntervistatoreUserId
      WHERE c.TenantId = @tenantId
      ORDER BY c.ScheduledAt DESC
`;
const { text, values } = tsqlRecruitingToPg(tsql, { tenantId: tid, take: 30 });
console.log("SQL:\n", text);
console.log("values", values);

const c = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
try {
  const r = await c.query(text, values);
  console.log("OK rows", r.rows.length);
} catch (e) {
  console.error("FAIL", e.message);
}
const o = await c.query(
  `SELECT "Id","Titolo" FROM "OfferteLavoro" WHERE "TenantId"=$1`,
  [tid]
);
console.log("offerte", o.rows);
await c.end();
