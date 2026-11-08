import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isAssistenzaViewRole, outcomeFromSessionUser } from "./assistenzaRoleAccess";

describe("assistenzaRoleAccess", () => {
  it("OPERATOR ha assistenza:view", () => {
    assert.equal(isAssistenzaViewRole("OPERATOR"), true);
  });

  it("ruolo sconosciuto senza assistenza:view", () => {
    assert.equal(isAssistenzaViewRole("GUEST" as never), false);
  });

  it("utente disattivato", () => {
    assert.deepEqual(
      outcomeFromSessionUser({ active: false, role: "ADMIN" }),
      { status: "inactive" },
    );
  });

  it("revoca assistenza:view", () => {
    assert.deepEqual(
      outcomeFromSessionUser({ active: true, role: "GUEST" as never }),
      { status: "no_assistenza" },
    );
  });

  it("utente assente", () => {
    assert.deepEqual(outcomeFromSessionUser(null), { status: "not_found" });
  });

  it("ruolo consentito", () => {
    assert.deepEqual(
      outcomeFromSessionUser({ active: true, role: "BACK_OFFICE" }),
      { status: "allowed", role: "BACK_OFFICE" },
    );
  });
});
