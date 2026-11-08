import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { assertGestionaleHelpClientPayload } from "./gestionaleHelpPayload";

describe("assertGestionaleHelpClientPayload", () => {
  it("accetta domanda e history", () => {
    assertGestionaleHelpClientPayload({
      question: "Come apro i filtri?",
      history: [],
    });
  });

  it("rifiuta chiavi operative", () => {
    assert.throws(() =>
      assertGestionaleHelpClientPayload({
        question: "test",
        praticaId: "x",
      }),
    );
  });
});
