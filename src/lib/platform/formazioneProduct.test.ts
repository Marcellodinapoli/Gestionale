import { test } from "node:test";
import assert from "node:assert/strict";
import { modulesFromPackages } from "./modules";
import {
  formazioneProductInvitePolicy,
  isFormazioneProductTenant,
  isFormazioneStandaloneTenant,
  tenantSkipsPostazione,
} from "./formazioneProduct";
import { resolvePlatformInvitePolicy } from "./productStandalone";
import { ruoliCreabiliDa } from "@/lib/permissions";
import { getProductStandaloneContext } from "./productStandalone";
import { addonOnlyMainNavHrefs } from "./addonOnlyTenantNav";

test("formazione standalone: pacchetto Formazione senza recovery", () => {
  const mods = modulesFromPackages(["formazione"]);
  assert.equal(isFormazioneStandaloneTenant(mods), true);
  assert.equal(isFormazioneProductTenant(mods), true);
  assert.ok(mods.includes("formazione"));
  assert.ok(mods.includes("strumenti"));
  assert.equal(isFormazioneProductTenant(modulesFromPackages(["credixa-base"])), false);
});

test("formazione product: invito Platform solo ADMIN", () => {
  const mods = modulesFromPackages(["formazione"]);
  const policy = resolvePlatformInvitePolicy(mods);
  assert.deepEqual(policy.allowedRoles, ["ADMIN"]);
  assert.equal(policy.defaultRole, "ADMIN");
  assert.match(policy.invalidRoleMessage, /Formazione/i);
  assert.deepEqual(formazioneProductInvitePolicy().allowedRoles, ["ADMIN"]);
});

test("formazione product: gerarchia ruoli in creazione operatori", () => {
  const ctx = getProductStandaloneContext(modulesFromPackages(["formazione"]));
  assert.equal(ctx.formazione, true);
  assert.deepEqual(ruoliCreabiliDa("ADMIN", { productStandalone: ctx }), [
    "SUPERVISOR",
    "OPERATOR",
  ]);
  assert.deepEqual(ruoliCreabiliDa("SUPERVISOR", { productStandalone: ctx }), [
    "OPERATOR",
  ]);
});

test("formazione product: niente postazione al login", () => {
  const mods = modulesFromPackages(["formazione"]);
  assert.equal(tenantSkipsPostazione(mods), true);
  assert.equal(tenantSkipsPostazione(modulesFromPackages(["credixa-base"])), false);
});

test("formazione standalone nav: Formazione, Strumenti AI e Account", () => {
  const nav = addonOnlyMainNavHrefs(modulesFromPackages(["formazione"]));
  assert.ok(nav?.has("/formazione/progressi"));
  assert.ok(nav?.has("/strumenti/ricerca-normativa"));
  assert.ok(nav?.has("/account"));
  assert.equal(nav?.has("/pratiche"), false);
});

test("formazione + recruiting: non è prodotto Formazione puro", () => {
  const mods = modulesFromPackages(["formazione", "recruiting"]);
  assert.equal(isFormazioneStandaloneTenant(mods), true);
  assert.equal(isFormazioneProductTenant(mods), false);
});
