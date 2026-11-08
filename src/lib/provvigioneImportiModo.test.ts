import test from "node:test";
import assert from "node:assert/strict";
import { importiProvvigionePerModo } from "./provvigioneImportiModo";
import { MODO_INCASSO_NON_PROVV, MODO_INCASSO_VERIFICATO } from "./incassoFattura";

test("np: importo e percentuale zero", () => {
  const r = importiProvvigionePerModo({
    modo: MODO_INCASSO_NON_PROVV,
    baseImporto: 100,
    metodo: "contanti",
    mandante: { provvigionePerc: 10 },
  });
  assert.equal(r.importo, 0);
  assert.equal(r.percentuale, 0);
});

test("ve: calcola provvigione", () => {
  const r = importiProvvigionePerModo({
    modo: MODO_INCASSO_VERIFICATO,
    baseImporto: 100,
    metodo: "contanti",
    mandante: { provvigionePerc: 10 },
  });
  assert.equal(r.importo, 10);
  assert.equal(r.percentuale, 10);
});
