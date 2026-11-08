import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import {
  inboundScreenPopScopeFromContext,
  type GruppoPerimetroContext,
} from "@/lib/gruppoPerimetroScope";
import type { SessionUser } from "@/lib/permissions";

const tenantId = "tenant-1";
const operator: SessionUser = {
  id: "op-1",
  email: "op@test.it",
  name: "Operatore",
  role: "OPERATOR",
  supervisorId: "sup-1",
  tenantId,
};

const periScope: Prisma.PraticaWhereInput = {
  mandanteId: "mand-1",
};

const ctxWithPeri: GruppoPerimetroContext = {
  nelGruppo: true,
  nessunPerimetroGruppo: false,
  gruppoMandanti: [{ mandanteId: "mand-1", perimetriIds: [] }],
  periScope,
  memberIds: ["sup-1", "op-1"],
};

const ctxNoPeri: GruppoPerimetroContext = {
  nelGruppo: true,
  nessunPerimetroGruppo: true,
  gruppoMandanti: [],
  periScope: null,
  memberIds: ["sup-1", "op-1"],
};

test("inbound pop: operatore con perimetro gruppo usa mandati del gruppo", () => {
  const scope = inboundScreenPopScopeFromContext(operator, ctxWithPeri);
  assert.deepEqual(scope, {
    AND: [{ tenantId }, periScope],
  });
});

test("inbound pop: senza perimetro gruppo ricade su praticaWhere operatore", () => {
  const scope = inboundScreenPopScopeFromContext(operator, ctxNoPeri);
  const and = (scope as { AND: unknown[] }).AND;
  assert.ok(Array.isArray(and));
  assert.ok(and.some((c) => JSON.stringify(c).includes("assegnatarioId")));
});
