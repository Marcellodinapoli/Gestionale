import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregaCodiciScaricoPratiche,
  shouldShowPraticheRiepilogoCodiciScarico,
} from "@/lib/praticheRiepilogoCodiciScarico";

test("shouldShowPraticheRiepilogoCodiciScarico: operatore e altri ruoli", () => {
  assert.equal(
    shouldShowPraticheRiepilogoCodiciScarico({
      showElenco: true,
      ricercaAnagrafica: false,
      role: "OPERATOR",
      operatore: undefined,
    }),
    true
  );
  assert.equal(
    shouldShowPraticheRiepilogoCodiciScarico({
      showElenco: true,
      ricercaAnagrafica: false,
      role: "SUPERVISOR",
      operatore: "user-1",
    }),
    true
  );
  assert.equal(
    shouldShowPraticheRiepilogoCodiciScarico({
      showElenco: true,
      ricercaAnagrafica: false,
      role: "SUPERVISOR",
      operatore: undefined,
    }),
    false
  );
});

test("aggregaCodiciScaricoPratiche: conta per codice e ordina", () => {
  const righe = aggregaCodiciScaricoPratiche([
    { stato: "IN_LAVORAZIONE", codiceScarico: "DRI" },
    { stato: "IN_LAVORAZIONE", codiceScarico: "LPT" },
    { stato: "IN_LAVORAZIONE", codiceScarico: "LPT" },
    { stato: "NUOVA", codiceScarico: null },
  ]);
  assert.deepEqual(righe, [
    { codice: "LPT", count: 2 },
    { codice: "DRI", count: 1 },
    { codice: "Senza codice", count: 1 },
  ]);
});
