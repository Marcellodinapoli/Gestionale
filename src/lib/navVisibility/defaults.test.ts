import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveEffectiveNavVisibility, baselinePageVisible } from "./defaults";
import { can } from "@/lib/permissions";

test("CredixaApp segue il default ruolo (può essere nascosta)", () => {
  const hidden = resolveEffectiveNavVisibility({
    role: "AMMINISTRAZIONE",
    roleDefaults: { AMMINISTRAZIONE: { creditcalc: false } },
  });
  assert.equal(hidden.creditcalc, false);

  const shown = resolveEffectiveNavVisibility({
    role: "AMMINISTRAZIONE",
    roleDefaults: { AMMINISTRAZIONE: { creditcalc: true } },
  });
  assert.equal(shown.creditcalc, true);
});

test("altre pagine rispettano false nel default ruolo", () => {
  const visible = resolveEffectiveNavVisibility({
    role: "AMMINISTRAZIONE",
    roleDefaults: {
      AMMINISTRAZIONE: {
        pratiche: false,
        mandanti: false,
        statistiche: true,
      },
    },
  });
  assert.equal(visible.pratiche, false);
  assert.equal(visible.mandanti, false);
  assert.equal(visible.statistiche, true);
});

test("Account resta sempre visibile", () => {
  const visible = resolveEffectiveNavVisibility({
    role: "OPERATOR",
    roleDefaults: { OPERATOR: { account: false } },
    userOverrides: { account: false },
  });
  assert.equal(visible.account, true);
});

test("AVVOCATO vede Legal AI, non Legal recupero crediti", () => {
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "legalAi"), true);
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "legal"), false);
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "home"), false);
  assert.equal(can({ role: "AVVOCATO" }, "legal-ai:view"), true);
  assert.equal(can({ role: "LEGAL" }, "legal-ai:view"), false);
});

test("legalAi rispettato nei default ruolo", () => {
  const hidden = resolveEffectiveNavVisibility({
    role: "AVVOCATO",
    roleDefaults: { AVVOCATO: { legalAi: false } },
  });
  assert.equal(hidden.legalAi, false);
});
