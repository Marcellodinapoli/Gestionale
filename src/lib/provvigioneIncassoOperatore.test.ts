import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperatoreProvvigioneIncasso } from "./provvigioneIncassoOperatore";

const titolare = "titolare-id";
const temporaneo = "temp-id";
const pinco = "pinco-id";

test("affido temporaneo: provvigione al titolare, non all'assegnatario in carico", () => {
  const op = resolveOperatoreProvvigioneIncasso(
    { assegnatarioId: temporaneo, operatoreTitolareId: titolare },
    temporaneo,
    "OPERATOR"
  );
  assert.equal(op, titolare);
});

test("affido definitivo: titolare coincide con assegnatario", () => {
  const op = resolveOperatoreProvvigioneIncasso(
    { assegnatarioId: pinco, operatoreTitolareId: pinco },
    pinco,
    "OPERATOR"
  );
  assert.equal(op, pinco);
});

test("senza titolare: operatore che registra l'incasso", () => {
  const op = resolveOperatoreProvvigioneIncasso(
    { assegnatarioId: null, operatoreTitolareId: null },
    pinco,
    "OPERATOR"
  );
  assert.equal(op, pinco);
});

test("senza titolare e incasso da admin: nessun operatore provvigionabile", () => {
  const op = resolveOperatoreProvvigioneIncasso(
    { assegnatarioId: null, operatoreTitolareId: null },
    "admin-id",
    "ADMIN"
  );
  assert.equal(op, null);
});

test("solo assegnatario legacy: conta come titolare", () => {
  const op = resolveOperatoreProvvigioneIncasso(
    { assegnatarioId: pinco, operatoreTitolareId: null },
    "admin-id",
    "ADMIN"
  );
  assert.equal(op, pinco);
});
