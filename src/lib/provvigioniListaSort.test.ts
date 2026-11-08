import test from "node:test";
import assert from "node:assert/strict";
import { sortProvvigioniRighe } from "./provvigioniListaSort";

const base = {
  perimetro: "A",
  operatoreNome: "Z",
  codiceScarico: "BTC",
  praticaNumero: "P1",
  debitoreNome: "Rossi",
  baseImporto: 100,
  percentuale: 4,
  importo: 4,
  stato: "MATURATA",
  statoLabel: "Maturata",
};

test("ordina per data incasso decrescente", () => {
  const righe = [
    { ...base, id: "1", data: "01/09/2026" },
    { ...base, id: "2", data: "07/09/2026" },
  ];
  const out = sortProvvigioniRighe(righe, "data", "desc");
  assert.equal(out[0]?.id, "2");
});
