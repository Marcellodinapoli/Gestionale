/**
 * Filtro PostazioneId sugli utenti (Neon): verifica SQL generata e, con un database
 * finto in memoria, che liberare/rilasciare una postazione tocchi solo gli utenti giusti.
 * Eseguire con `npm test` (scripts/run-tests.mjs): neonQuery è sostituito da un fake.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNeonUsersAdminRepository } from "@/lib/neon/NeonUsersAdminRepository";
import { usersDb } from "@/lib/usersRepo";
import { liberaPostazioneDaResidui } from "@/lib/postazioneAssign";

type Row = Record<string, unknown>;
type Query = { text: string; params: unknown[] };

const TENANT = "11111111-1111-4111-8111-111111111111";
const DESK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DESK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OLD = "2026-10-01T08:00:00.000Z";
const OLD_LOGOUT = "2026-10-01T18:00:00.000Z";

let table: Row[] = [];
let queries: Query[] = [];

function user(n: number, over: Row): Row {
  return {
    Id: uid(n), TenantId: TENANT, Email: `u${n}@test.local`, Name: `U${n}`, Role: "OPERATOR",
    Active: true, FormazioneOnly: false, PostazioneId: null, PostazioneFissa: false,
    LastLoginAt: OLD, LastLogoutAt: OLD_LOGOUT, ...over,
  };
}

/** Valuta le sole forme di predicato prodotte da buildFilter/loadUser (AND di condizioni). */
function matches(row: Row, where: string, params: unknown[]): boolean {
  for (const raw of where.split(/\s+AND\s+/)) {
    const p = raw.trim();
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^u\."(\w+)" IS NULL$/))) { if (row[m[1]] != null) return false; continue; }
    if ((m = p.match(/^u\."(\w+)" = ANY\(\$(\d+)::\w+\[\]\)$/))) {
      if (!(params[+m[2] - 1] as unknown[]).includes(row[m[1]])) return false; continue;
    }
    if ((m = p.match(/^lower\(u\."(\w+)"\) = lower\(\$(\d+)\)$/))) {
      if (String(row[m[1]]).toLowerCase() !== String(params[+m[2] - 1]).toLowerCase()) return false; continue;
    }
    if ((m = p.match(/^u\."(\w+)" (=|<>) \$(\d+)(?:::\w+)?$/))) {
      const eq = row[m[1]] === params[+m[3] - 1];
      if (m[2] === "=" ? !eq : eq) return false; continue;
    }
    throw new Error(`predicato non gestito dal fake: ${p}`);
  }
  return true;
}

function fakeNeon(text: string, params: unknown[]): Row[] {
  queries.push({ text, params });
  const sql = text.replace(/\s+/g, " ").trim();
  let m: RegExpMatchArray | null;
  if ((m = sql.match(/^SELECT COUNT\(\*\)::int AS c FROM "Users" u WHERE (.+)$/))) {
    return [{ c: table.filter((r) => matches(r, m![1], params)).length }];
  }
  if ((m = sql.match(/^SELECT .+ FROM "Users" u .*?WHERE (.+?) ORDER BY .+ LIMIT \$(\d+) OFFSET \$(\d+)$/))) {
    const rows = table.filter((r) => matches(r, m![1], params));
    const take = Number(params[+m[2] - 1]);
    const skip = Number(params[+m[3] - 1]);
    return rows.slice(skip, skip + take).map((r) => ({ ...r }));
  }
  if ((m = sql.match(/^SELECT .+ FROM "Users" u .*?WHERE (.+?) LIMIT 1$/))) {
    return table.filter((r) => matches(r, m![1], params)).slice(0, 1).map((r) => ({ ...r }));
  }
  if ((m = sql.match(/^UPDATE "Users" SET (.+) WHERE "Id" = \$(\d+)::uuid AND "TenantId" = \$(\d+)::uuid$/))) {
    const id = params[+m[2] - 1];
    const tenant = params[+m[3] - 1];
    const sets = m[1].split(/,\s*(?=")/).map((s) => s.match(/^"(\w+)" = (NULL|\$(\d+))(?:::\w+)?$/));
    for (const r of table) {
      if (r.Id !== id || r.TenantId !== tenant) continue;
      for (const s of sets) {
        if (!s) throw new Error(`SET non gestito: ${m[1]}`);
        r[s[1]] = s[2] === "NULL" ? null : params[+s[3] - 1];
      }
    }
    return [];
  }
  throw new Error(`query non gestita dal fake: ${sql.slice(0, 120)}`);
}

beforeEach(() => {
  queries = [];
  table = [];
  (globalThis as { __fakeNeonQuery?: unknown }).__fakeNeonQuery = fakeNeon;
});

const snapshot = () => JSON.parse(JSON.stringify(table)) as Row[];
const byId = (rows: Row[], n: number) => rows.find((r) => r.Id === uid(n))!;

test("buildFilter: postazioneId stringa → predicato uuid con parametro nella posizione giusta", async () => {
  const repo = createNeonUsersAdminRepository("demo");
  await repo.count("demo", TENANT, { active: true, postazioneId: DESK_A, excludeId: uid(9) });
  const q = queries[0];
  assert.match(q.text, /u\."TenantId" = \$1::uuid AND u\."Active" = \$2 AND u\."Id" <> \$3::uuid AND u\."PostazioneId" = \$4::uuid/);
  assert.deepEqual(q.params, [TENANT, true, uid(9), DESK_A]);
});

test("buildFilter: postazioneId null → IS NULL, senza parametri aggiuntivi", async () => {
  const repo = createNeonUsersAdminRepository("demo");
  await repo.count("demo", TENANT, { postazioneIdSet: true, postazioneId: null });
  assert.match(queries[0].text, /u\."PostazioneId" IS NULL/);
  assert.doesNotMatch(queries[0].text, /= NULL/);
  assert.deepEqual(queries[0].params, [TENANT]);
});

test("buildFilter: postazioneId non uuid → nessun risultato e nessuna query", async () => {
  const repo = createNeonUsersAdminRepository("demo");
  assert.equal(await repo.count("demo", TENANT, { postazioneId: "non-uuid" }), 0);
  assert.equal(queries.length, 0);
});

test("buildFilter: senza postazioneId nessun predicato sulla postazione", async () => {
  const repo = createNeonUsersAdminRepository("demo");
  await repo.count("demo", TENANT, { active: true });
  assert.doesNotMatch(queries[0].text, /PostazioneId/);
});

test("where postazioneId: null (usersDb) restituisce solo righe con PostazioneId nullo", async () => {
  table = [user(1, { PostazioneId: null }), user(2, { PostazioneId: DESK_A }), user(3, { PostazioneId: null })];
  const rows = await usersDb({ tenantId: TENANT, tenantSlug: "demo" }).findMany({
    where: { tenantId: TENANT, postazioneId: null },
    select: { id: true },
  });
  assert.deepEqual(rows.map((r) => r.id).sort(), [uid(1), uid(3)]);
});

test("liberaPostazioneDaResidui: libera solo i residui della postazione scelta", async () => {
  const recent = new Date(Date.now() - 60_000).toISOString();
  table = [
    user(0, { PostazioneId: null }), // utente che conferma
    user(1, { PostazioneId: DESK_A }), // residuo su A, sessione chiusa → da liberare
    user(2, { PostazioneId: DESK_A, PostazioneFissa: true }), // fissa su A → resta
    user(3, { PostazioneId: DESK_A, LastLoginAt: recent, LastLogoutAt: null }), // sessione aperta → resta
    user(4, { PostazioneId: DESK_B }), // altra postazione, sessione chiusa → non toccare
    user(5, { PostazioneId: null }), // senza postazione → non toccare
    user(6, { PostazioneId: DESK_B, PostazioneFissa: true }), // fissa su B → non toccare
  ];
  const before = snapshot();
  await liberaPostazioneDaResidui(DESK_A, uid(0), TENANT, "demo");
  const after = snapshot();

  assert.equal(byId(after, 1).PostazioneId, null, "il residuo su A viene liberato");
  assert.notEqual(byId(after, 1).LastLogoutAt, OLD_LOGOUT, "il residuo su A riceve lastLogoutAt");
  for (const n of [0, 2, 3, 4, 5, 6]) {
    assert.deepEqual(byId(after, n), byId(before, n), `utente ${n} invariato`);
  }
  const updates = queries.filter((q) => q.text.startsWith("UPDATE"));
  assert.equal(updates.length, 1, "un solo UPDATE (solo il residuo di A)");
});

test("liberaPostazioneDaResidui: nessun residuo → nessun UPDATE", async () => {
  table = [user(0, {}), user(4, { PostazioneId: DESK_B }), user(5, {})];
  const before = snapshot();
  await liberaPostazioneDaResidui(DESK_A, uid(0), TENANT, "demo");
  assert.deepEqual(snapshot(), before);
  assert.equal(queries.filter((q) => q.text.startsWith("UPDATE")).length, 0);
});

test("updateMany per postazione (disattiva/elimina postazione) tocca solo gli utenti di quella postazione", async () => {
  table = [
    user(1, { PostazioneId: DESK_A, PostazioneFissa: true }),
    user(2, { PostazioneId: DESK_A }),
    user(3, { PostazioneId: DESK_B, PostazioneFissa: true }),
    user(4, { PostazioneId: null }),
  ];
  const before = snapshot();
  await usersDb({ tenantId: TENANT, tenantSlug: "demo" }).updateMany({
    where: { postazioneId: DESK_A, tenantId: TENANT },
    data: { postazioneId: null, postazioneFissa: false },
  });
  const after = snapshot();
  for (const n of [1, 2]) {
    assert.equal(byId(after, n).PostazioneId, null);
    assert.equal(byId(after, n).PostazioneFissa, false);
  }
  for (const n of [3, 4]) assert.deepEqual(byId(after, n), byId(before, n), `utente ${n} invariato`);
});
