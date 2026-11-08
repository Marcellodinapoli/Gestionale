import { test } from "node:test";
import assert from "node:assert/strict";
import { modulesFromPackages } from "./modules";
import {
  addonOnlyMainNavHrefs,
  isRecruitingStandaloneTenant,
} from "./addonOnlyTenantNav";
import { isLegalAiStandaloneTenant } from "./legalAiStandalone";

test("recruiting standalone: pacchetto Recruiter senza recovery", () => {
  const mods = modulesFromPackages(["recruiting"]);
  assert.equal(isRecruitingStandaloneTenant(mods), true);
  assert.equal(isRecruitingStandaloneTenant(modulesFromPackages(["credixa-base"])), false);
  const nav = addonOnlyMainNavHrefs(mods);
  assert.ok(nav?.has("/recruiting"));
  assert.ok(nav?.has("/account"));
  assert.equal(nav?.has("/pratiche"), false);
});

test("addon only nav: legal-ai e recruiting insieme senza recovery", () => {
  const mods = modulesFromPackages(["legal-ai", "recruiting"]);
  const nav = addonOnlyMainNavHrefs(mods);
  assert.ok(nav?.has("/legal-ai"));
  assert.ok(nav?.has("/recruiting"));
});

test("legal ai standalone: re-export invariato", () => {
  const mods = modulesFromPackages(["legal-ai"]);
  assert.equal(isLegalAiStandaloneTenant(mods), true);
  assert.ok(addonOnlyMainNavHrefs(mods)?.has("/legal-ai"));
});

test("recovery tenant: menu non ridotto", () => {
  assert.equal(addonOnlyMainNavHrefs(modulesFromPackages(["credixa-base"])), null);
});
