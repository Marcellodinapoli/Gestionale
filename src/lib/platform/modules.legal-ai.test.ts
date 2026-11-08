import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CREDIXA_FULL_MODULES,
  hasModule,
  modulesFromPackages,
  packagesFromModules,
  RECOVERY_DEFAULT_MODULES,
} from "./modules";
import { can, type Role } from "@/lib/permissions";

test("legal-ai non è nel default recovery né attivo senza config esplicita", () => {
  assert.equal(RECOVERY_DEFAULT_MODULES.includes("legal-ai"), false);
  assert.equal(hasModule(undefined, "legal-ai"), false);
  assert.equal(hasModule([...RECOVERY_DEFAULT_MODULES], "legal-ai"), false);
});

test("legale resta distinto e attivo nel default recovery", () => {
  assert.equal(hasModule(undefined, "legale"), true);
  assert.equal(hasModule(undefined, "legal-ai"), false);
});

test("pacchetto add-on legal-ai abilita solo legal-ai (+ core)", () => {
  const mods = modulesFromPackages(["legal-ai"]);
  assert.equal(mods.includes("core"), true);
  assert.equal(mods.includes("legal-ai"), true);
  assert.equal(mods.includes("legale"), false);
  assert.equal(mods.includes("recovery"), false);
  assert.equal(
    packagesFromModules(mods).includes("legal-ai"),
    true
  );
});

test("Credixa full include legal-ai", () => {
  assert.equal(CREDIXA_FULL_MODULES.includes("legal-ai"), true);
  const full = modulesFromPackages(["credixa-full"]);
  assert.equal(full.includes("legal-ai"), true);
});

test("ruolo LEGAL non ha legal-ai:view; AVVOCATO sì", () => {
  const legalUser = { role: "LEGAL" as Role };
  const avvocatoUser = { role: "AVVOCATO" as Role };
  assert.equal(can(legalUser, "legal:view"), true);
  assert.equal(can(legalUser, "legal-ai:view"), false);
  assert.equal(can(avvocatoUser, "legal-ai:view"), true);
  assert.equal(can(avvocatoUser, "legal:view"), false);
});
