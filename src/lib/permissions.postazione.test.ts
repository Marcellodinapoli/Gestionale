import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mustChoosePostazioneAlLogin,
  requiresPostazione,
  type Role,
} from "./permissions";

test("AVVOCATO: requiresPostazione false senza postazione", () => {
  assert.equal(
    requiresPostazione({ role: "AVVOCATO", formazioneOnly: false }),
    false
  );
  assert.equal(
    mustChoosePostazioneAlLogin({
      role: "AVVOCATO",
      formazioneOnly: false,
      postazioneId: null,
    }),
    false
  );
});

test("AVVOCATO: requiresPostazione false anche con postazione assegnata", () => {
  assert.equal(
    requiresPostazione({ role: "AVVOCATO", formazioneOnly: false }),
    false
  );
  assert.equal(
    mustChoosePostazioneAlLogin({
      role: "AVVOCATO",
      formazioneOnly: false,
      postazioneId: "00000000-0000-4000-8000-000000000001",
    }),
    false
  );
});

test("OPERATOR: senza postazione deve ancora selezionarla al login", () => {
  assert.equal(
    requiresPostazione({ role: "OPERATOR", formazioneOnly: false }),
    true
  );
  assert.equal(
    mustChoosePostazioneAlLogin({
      role: "OPERATOR",
      formazioneOnly: false,
      postazioneId: null,
    }),
    true
  );
});

test("formazioneOnly: nessun ruolo richiede postazione (regressione)", () => {
  const roles: Role[] = ["OPERATOR", "AVVOCATO", "ADMIN"];
  for (const role of roles) {
    assert.equal(requiresPostazione({ role, formazioneOnly: true }), false);
    assert.equal(
      mustChoosePostazioneAlLogin({
        role,
        formazioneOnly: true,
        postazioneId: null,
      }),
      false
    );
  }
});
