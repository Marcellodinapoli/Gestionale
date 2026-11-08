import test from "node:test";
import assert from "node:assert/strict";
import { nettoDaPagareEffettivoLista } from "@/lib/praticheListaRow";

test("netto da pagare elenco: nettoDaPagare meno incassi come in scheda", () => {
  assert.equal(nettoDaPagareEffettivoLista(4637.51, 774.64, 774.64), 0);
  assert.equal(
    Math.round(nettoDaPagareEffettivoLista(4637.51, null, 774.64) * 100),
    386287
  );
});
