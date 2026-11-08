/**
 * Test integrazione accept-invite su Neon.
 * Uso: npx tsx scripts/test-accept-invite.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Module from "node:module";

// Permette di importare moduli con `import "server-only"` da script CLI
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, arguments);
};

function loadEnv() {
  try {
    const env = readFileSync(resolve(".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const { acceptInvite, AcceptInviteError, hashInviteToken } = await import(
  "../src/lib/neon/acceptInvite.ts"
);
const { neonQuery } = await import("../src/lib/neon/pool.ts");

const stamp = Date.now().toString(36);
const slug = `test-invite-${stamp}`;
const email = `admin-${stamp}@example.com`;
const goodPassword = "Secret1!";
let tenantId = "";
let passed = 0;
let failed = 0;

function shaToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function createInviteRow({ tenantId, email, expiresInHours = 2 }) {
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const tokenHash = shaToken(token);
  const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString();
  await neonQuery(
    `INSERT INTO "TenantInvites" (
      "Id", "TenantId", "Email", "Role", "TokenHash",
      "ExpiresAt", "UsedAt", "CreatedByPlatformAdmin", "CreatedAt"
    ) VALUES (
      $1::uuid, $2::uuid, $3, 'ADMIN', $4,
      $5::timestamptz, NULL, 'test-script', now()
    )`,
    [id, tenantId, email, tokenHash, expiresAt]
  );
  return { id, token };
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed += 1;
  } catch (e) {
    console.error(`FAIL ${name}`);
    console.error(e instanceof Error ? e.stack || e.message : e);
    failed += 1;
  }
}

async function cleanup() {
  if (!tenantId) return;
  try {
    await neonQuery(`DELETE FROM "Users" WHERE "TenantId" = $1::uuid`, [tenantId]);
    await neonQuery(`DELETE FROM "TenantInvites" WHERE "TenantId" = $1::uuid`, [tenantId]);
    await neonQuery(`DELETE FROM "Tenants" WHERE "Id" = $1::uuid`, [tenantId]);
  } catch (e) {
    console.warn("cleanup:", e instanceof Error ? e.message : e);
  }
}

try {
  tenantId = randomUUID();
  await neonQuery(
    `INSERT INTO "Tenants" (
      "Id", "Slug", "Nome", "Active", "CreatedAt", "Status", "PerfMonitoringEnabled"
    ) VALUES (
      $1::uuid, $2, $3, false, now(), 'IN_CONFIGURAZIONE', false
    )`,
    [tenantId, slug, `Test Invite ${stamp}`]
  );

  const invite = await createInviteRow({ tenantId, email });

  await check("1 token valido → user + UsedAt", async () => {
    const res = await acceptInvite(invite.token, goodPassword, goodPassword);
    assert.equal(res.email, email);
    assert.equal(res.role, "ADMIN");
    const users = await neonQuery(
      `SELECT "Id", "Role", "PasswordHash" FROM "Users"
       WHERE "TenantId" = $1::uuid AND lower("Email") = lower($2)`,
      [tenantId, email]
    );
    assert.equal(users.length, 1);
    assert.equal(String(users[0].Role), "ADMIN");
    assert.notEqual(String(users[0].PasswordHash), goodPassword);
    const inv = await neonQuery(
      `SELECT "UsedAt", "TokenHash" FROM "TenantInvites" WHERE "Id" = $1::uuid`,
      [invite.id]
    );
    assert.ok(inv[0].UsedAt != null);
    assert.equal(String(inv[0].TokenHash), hashInviteToken(invite.token));
    const t = await neonQuery(
      `SELECT "Status", "Active" FROM "Tenants" WHERE "Id" = $1::uuid`,
      [tenantId]
    );
    assert.equal(String(t[0].Status), "IN_CONFIGURAZIONE");
    assert.equal(Boolean(t[0].Active), false);
  });

  await check("2 token inesistente → rifiuto", async () => {
    await assert.rejects(
      () => acceptInvite("0".repeat(64), goodPassword, goodPassword),
      (e) => e instanceof AcceptInviteError && e.code === "INVITE_INVALID"
    );
  });

  await check("3 token scaduto → rifiuto", async () => {
    const expired = await createInviteRow({
      tenantId,
      email: `expired-${stamp}@example.com`,
    });
    await neonQuery(
      `UPDATE "TenantInvites" SET "ExpiresAt" = now() - interval '1 hour' WHERE "Id" = $1::uuid`,
      [expired.id]
    );
    await assert.rejects(
      () => acceptInvite(expired.token, goodPassword, goodPassword),
      (e) => e instanceof AcceptInviteError && e.code === "INVITE_INVALID"
    );
  });

  await check("4 token già usato → rifiuto", async () => {
    await assert.rejects(
      () => acceptInvite(invite.token, goodPassword, goodPassword),
      (e) => e instanceof AcceptInviteError && e.code === "INVITE_INVALID"
    );
  });

  await check("5 password confirmation diversa → rifiuto", async () => {
    const inv = await createInviteRow({
      tenantId,
      email: `mismatch-${stamp}@example.com`,
    });
    await assert.rejects(
      () => acceptInvite(inv.token, goodPassword, "Other1!"),
      (e) => e instanceof AcceptInviteError && e.code === "PASSWORD_MISMATCH"
    );
    const row = await neonQuery(
      `SELECT "UsedAt" FROM "TenantInvites" WHERE "Id" = $1::uuid`,
      [inv.id]
    );
    assert.equal(row[0].UsedAt, null);
  });

  await check("6 password non valida → rifiuto", async () => {
    const inv = await createInviteRow({
      tenantId,
      email: `weak-${stamp}@example.com`,
    });
    await assert.rejects(
      () => acceptInvite(inv.token, "weak", "weak"),
      (e) => e instanceof AcceptInviteError && e.code === "PASSWORD_WEAK"
    );
  });

  await check("7 utente già esistente → nessun duplicato", async () => {
    const inv = await createInviteRow({ tenantId, email });
    await assert.rejects(
      () => acceptInvite(inv.token, goodPassword, goodPassword),
      (e) => e instanceof AcceptInviteError && e.code === "USER_EXISTS"
    );
    const count = await neonQuery(
      `SELECT COUNT(*)::int AS n FROM "Users"
       WHERE "TenantId" = $1::uuid AND lower("Email") = lower($2)`,
      [tenantId, email]
    );
    assert.equal(Number(count[0].n), 1);
    const row = await neonQuery(
      `SELECT "UsedAt" FROM "TenantInvites" WHERE "Id" = $1::uuid`,
      [inv.id]
    );
    assert.equal(row[0].UsedAt, null);
  });

  await check("8 errore creazione utente → UsedAt resta NULL", async () => {
    const inv = await createInviteRow({
      tenantId,
      email: `rollback-${stamp}@example.com`,
    });
    await neonQuery(`
      CREATE OR REPLACE FUNCTION test_fail_users_insert()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced_user_insert_failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await neonQuery(`DROP TRIGGER IF EXISTS test_fail_users_insert_trg ON "Users"`);
    await neonQuery(`
      CREATE TRIGGER test_fail_users_insert_trg
      BEFORE INSERT ON "Users"
      FOR EACH ROW EXECUTE PROCEDURE test_fail_users_insert()
    `);
    try {
      await assert.rejects(() =>
        acceptInvite(inv.token, goodPassword, goodPassword)
      );
      const row = await neonQuery(
        `SELECT "UsedAt" FROM "TenantInvites" WHERE "Id" = $1::uuid`,
        [inv.id]
      );
      assert.equal(row[0].UsedAt, null);
      const users = await neonQuery(
        `SELECT COUNT(*)::int AS n FROM "Users"
         WHERE "TenantId" = $1::uuid AND lower("Email") = lower($2)`,
        [tenantId, `rollback-${stamp}@example.com`]
      );
      assert.equal(Number(users[0].n), 0);
    } finally {
      await neonQuery(`DROP TRIGGER IF EXISTS test_fail_users_insert_trg ON "Users"`);
      await neonQuery(`DROP FUNCTION IF EXISTS test_fail_users_insert()`);
    }
  });

  await check("9 due accept concorrenti → uno solo vince", async () => {
    const inv = await createInviteRow({
      tenantId,
      email: `race-${stamp}@example.com`,
    });
    const results = await Promise.allSettled([
      acceptInvite(inv.token, goodPassword, goodPassword),
      acceptInvite(inv.token, goodPassword, goodPassword),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const ko = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(ko.length, 1);
    const users = await neonQuery(
      `SELECT COUNT(*)::int AS n FROM "Users"
       WHERE "TenantId" = $1::uuid AND lower("Email") = lower($2)`,
      [tenantId, `race-${stamp}@example.com`]
    );
    assert.equal(Number(users[0].n), 1);
  });

  await check("10 createInvite platform shape non toccata (hash-only in DB)", async () => {
    const inv = await createInviteRow({
      tenantId,
      email: `shape-${stamp}@example.com`,
    });
    const row = await neonQuery(
      `SELECT "TokenHash", "UsedAt" FROM "TenantInvites" WHERE "Id" = $1::uuid`,
      [inv.id]
    );
    assert.equal(String(row[0].TokenHash), hashInviteToken(inv.token));
    assert.notEqual(String(row[0].TokenHash), inv.token);
    assert.equal(row[0].UsedAt, null);
  });
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
