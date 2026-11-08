import { test } from "node:test";
import assert from "node:assert/strict";
import { modulesFromPackages } from "./modules";
import {
  isLegalAiStandaloneTenant,
  LEGAL_AI_STANDALONE_ADMIN_HREFS,
} from "./legalAiStandalone";
import { ruoliCreabiliDa } from "@/lib/permissions";
import { baselinePageVisible } from "@/lib/navVisibility/defaults";

test("legal-ai standalone: add-on senza recovery", () => {
  const mods = modulesFromPackages(["legal-ai"]);
  assert.equal(isLegalAiStandaloneTenant(mods), true);
  assert.equal(isLegalAiStandaloneTenant(modulesFromPackages(["credixa-base"])), false);
  assert.equal(
    isLegalAiStandaloneTenant(modulesFromPackages(["credixa-full"])),
    false
  );
});

test("legal-ai standalone: admin href per Operatori", () => {
  assert.equal(LEGAL_AI_STANDALONE_ADMIN_HREFS.has("/operatori"), true);
});

test("ruoli creabili standalone: solo AVVOCATO da admin/bk off", () => {
  assert.deepEqual(
    ruoliCreabiliDa("ADMIN", { legalAiStandalone: true }),
    ["AVVOCATO"]
  );
  assert.deepEqual(
    ruoliCreabiliDa("BACK_OFFICE", { legalAiStandalone: true }),
    ["AVVOCATO"]
  );
});

test("AVVOCATO: menu solo Legal AI (Account locked altrove)", () => {
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "legalAi"), true);
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "account"), true);
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "home"), false);
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "pratiche"), false);
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "operatori"), false);
});
