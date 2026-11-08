import { test } from "node:test";
import assert from "node:assert/strict";
import { modulesFromPackages } from "./modules";
import {
  dialerProductInvitePolicy,
  isDialerProductTenant,
  isDialerStandaloneTenant,
} from "./dialerProduct";
import { resolvePlatformInvitePolicy, getProductStandaloneContext } from "./productStandalone";
import { ruoliCreabiliDa } from "@/lib/permissions";
import { addonOnlyMainNavHrefs } from "./addonOnlyTenantNav";
import { tenantSkipsPostazione } from "./formazioneProduct";

test("dialer standalone: pacchetto Predictive senza recovery", () => {
  const mods = modulesFromPackages(["dialer"]);
  assert.equal(isDialerStandaloneTenant(mods), true);
  assert.equal(isDialerProductTenant(mods), true);
  assert.ok(mods.includes("dialer"));
  assert.equal(isDialerProductTenant(modulesFromPackages(["credixa-base"])), false);
});

test("dialer product: invito Platform solo ADMIN", () => {
  const mods = modulesFromPackages(["dialer"]);
  const policy = resolvePlatformInvitePolicy(mods);
  assert.deepEqual(policy.allowedRoles, ["ADMIN"]);
  assert.equal(policy.defaultRole, "ADMIN");
  assert.match(policy.invalidRoleMessage, /Predictive/i);
  assert.deepEqual(dialerProductInvitePolicy().allowedRoles, ["ADMIN"]);
});

test("dialer product: gerarchia ruoli in creazione operatori", () => {
  const ctx = getProductStandaloneContext(modulesFromPackages(["dialer"]));
  assert.equal(ctx.dialer, true);
  assert.deepEqual(ruoliCreabiliDa("ADMIN", { productStandalone: ctx }), [
    "SUPERVISOR",
    "OPERATOR",
  ]);
  assert.deepEqual(ruoliCreabiliDa("SUPERVISOR", { productStandalone: ctx }), [
    "OPERATOR",
  ]);
});

test("dialer product: postazioni richieste al login (non come Formazione)", () => {
  const mods = modulesFromPackages(["dialer"]);
  assert.equal(tenantSkipsPostazione(mods), false);
});

test("dialer standalone nav: Predictive + Account", () => {
  const nav = addonOnlyMainNavHrefs(modulesFromPackages(["dialer"]));
  assert.ok(nav?.has("/predictive"));
  assert.ok(nav?.has("/account"));
  assert.equal(nav?.has("/pratiche"), false);
});

test("dialer + formazione: non è prodotto Predictive puro", () => {
  const mods = modulesFromPackages(["dialer", "formazione"]);
  assert.equal(isDialerStandaloneTenant(mods), true);
  assert.equal(isDialerProductTenant(mods), false);
});
