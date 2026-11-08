import { test } from "node:test";
import assert from "node:assert/strict";
import { messaggioErroreGruppoMandanti } from "./gruppoMandantiUi";

test("messaggioErroreGruppoMandanti: richiede mandante e perimetro", () => {
  assert.equal(messaggioErroreGruppoMandanti([]), "Aggiungi almeno una mandante e un perimetro al gruppo");
  assert.equal(
    messaggioErroreGruppoMandanti([{ mandanteId: "m1", perimetriIds: [] }]),
    "Ogni mandante deve avere almeno un perimetro selezionato"
  );
  assert.equal(
    messaggioErroreGruppoMandanti([{ mandanteId: "m1", perimetriIds: ["p1"] }]),
    null
  );
});
