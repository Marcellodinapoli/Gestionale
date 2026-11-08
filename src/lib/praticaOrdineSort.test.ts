import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOrderBy, prismaOrderByToSort } from "./praticaOrdine";

test("prismaOrderByToSort inverte buildOrderBy", () => {
  assert.deepEqual(prismaOrderByToSort(buildOrderBy("debitore", "asc")), {
    field: "debitore",
    dir: "asc",
  });
  assert.deepEqual(prismaOrderByToSort(buildOrderBy("mandante", "desc")), {
    field: "mandante",
    dir: "desc",
  });
});
