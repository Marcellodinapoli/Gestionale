import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNeonAuditRepository } from "@/lib/neon/NeonAuditRepository";
import { auditRepo } from "@/lib/auditRepo";

type Query = { text: string; params: unknown[] };

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

let queries: Query[] = [];

beforeEach(() => {
  queries = [];
  (globalThis as { __fakeNeonQuery?: unknown }).__fakeNeonQuery = async (
    text: string,
    params: unknown[] = []
  ) => {
    queries.push({ text: text.replace(/\s+/g, " ").trim(), params });
    if (text.includes('FROM "AuditLog"')) {
      return [
        {
          Id: "33333333-3333-4333-8333-333333333333",
          TenantId: TENANT,
          UserId: USER,
          Action: "stato_update",
          Entity: "pratica",
          EntityId: "p-1",
          MetadataJson: "INCASSO",
          CreatedAt: "2026-10-15T10:00:00.000Z",
          UserName: "Ada",
        },
      ];
    }
    return [];
  };
});

test("append scrive AuditLog su Neon, dettaglio in MetadataJson", async () => {
  await createNeonAuditRepository("demo").append("demo", {
    tenantId: TENANT,
    userId: USER,
    action: "login",
    entity: "user",
    entityId: USER,
    dettaglio: null,
  });
  const q = queries[0];
  assert.match(q.text, /INSERT INTO "AuditLog"/);
  assert.match(q.text, /"MetadataJson"/);
  assert.doesNotMatch(q.text, /Dettaglio/);
  assert.deepEqual(q.params.slice(1), [TENANT, USER, "login", "user", USER, null]);
});

test("list filtra tenant, azioni e periodo e mappa MetadataJson in dettaglio", async () => {
  const rows = await createNeonAuditRepository("demo").list("demo", TENANT, {
    entity: "pratica",
    action: ["stato_update", "piano"],
    createdAtGte: "2026-10-15T00:00:00.000Z",
    createdAtLt: "2026-10-16T00:00:00.000Z",
    entityIdsIn: ["p-1"],
    includeUser: true,
    orderBy: "asc",
    take: 5000,
    skip: 0,
  });
  const q = queries[0];
  assert.match(q.text, /FROM "AuditLog" a/);
  assert.match(q.text, /LEFT JOIN "Users"/);
  assert.match(q.text, /ORDER BY a\."CreatedAt" ASC/);
  assert.deepEqual(q.params, [
    TENANT,
    "pratica",
    ["p-1"],
    ["stato_update", "piano"],
    "2026-10-15T00:00:00.000Z",
    "2026-10-16T00:00:00.000Z",
    5000,
    0,
  ]);
  assert.equal(rows[0]?.dettaglio, "INCASSO");
  assert.deepEqual(rows[0]?.user, { id: USER, name: "Ada" });
});

test("con DATABASE_PROVIDER=neon l'audit del login non passa da Prisma", async () => {
  await auditRepo({ tenantId: TENANT, tenantSlug: "demo" }).append("demo", {
    tenantId: TENANT,
    userId: USER,
    action: "login",
    entity: "user",
    entityId: USER,
  });
  assert.match(queries[0].text, /INSERT INTO "AuditLog"/);
});
