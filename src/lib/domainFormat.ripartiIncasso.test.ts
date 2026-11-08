import test from "node:test";
import assert from "node:assert/strict";
import { ripartiIncasso, roundMoney } from "@/lib/domainFormat";

function assertMoney(actual: number, expected: number) {
  assert.equal(roundMoney(actual), roundMoney(expected));
}

const pratica = {
  capitale: 438,
  interessi: 81.52,
  spese: 88.24,
  speseRecupero: 37.95,
  importoRata: 147,
};
const giaVuoto = { capitale: 0, interessi: 0, spese: 0, speseRec: 0 };

test("ripartiIncasso: capitale → mora → spese → spese recupero", () => {
  const r200 = ripartiIncasso(200, pratica, giaVuoto);
  assert.equal(r200.capitale, 200);
  assert.equal(r200.interessi, 0);
  assert.equal(r200.spese, 0);
  assert.equal(r200.speseRec, 0);

  const r500 = ripartiIncasso(500, pratica, giaVuoto);
  assert.equal(r500.capitale, 438);
  assert.equal(r500.interessi, 62);
  assert.equal(r500.spese, 0);
  assert.equal(r500.speseRec, 0);

  const r650 = ripartiIncasso(650, pratica, giaVuoto);
  assertMoney(r650.capitale, 438);
  assertMoney(r650.interessi, 81.52);
  assertMoney(r650.spese, 88.24);
  assertMoney(r650.speseRec, 37.95);
});
