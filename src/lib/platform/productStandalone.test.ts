import { test } from "node:test";
import assert from "node:assert/strict";
import { modulesFromPackages } from "./modules";
import {
  getProductStandaloneContext,
  inviteEmailRolePhrase,
  resolvePlatformInvitePolicy,
  standaloneOperatoreRoles,
} from "./productStandalone";
import { ruoliCreabiliDa } from "@/lib/permissions";
import { baselinePageVisible } from "@/lib/navVisibility/defaults";

test("recruiting standalone: invito solo RECRUITER", () => {
  const mods = modulesFromPackages(["recruiting"]);
  const policy = resolvePlatformInvitePolicy(mods);
  assert.deepEqual(policy.allowedRoles, ["RECRUITER"]);
  assert.equal(policy.defaultRole, "RECRUITER");
  assert.equal(inviteEmailRolePhrase("RECRUITER"), "reclutatore");
});

test("legal ai standalone: invito solo AVVOCATO", () => {
  const mods = modulesFromPackages(["legal-ai"]);
  const policy = resolvePlatformInvitePolicy(mods);
  assert.deepEqual(policy.allowedRoles, ["AVVOCATO"]);
});

test("ruoli creabili standalone recruiting", () => {
  const ctx = getProductStandaloneContext(modulesFromPackages(["recruiting"]));
  assert.deepEqual(ruoliCreabiliDa("ADMIN", { productStandalone: ctx }), ["RECRUITER"]);
});

test("RECRUITER: menu solo Recruiting", () => {
  assert.equal(baselinePageVisible({ role: "RECRUITER" }, "recruiting"), true);
  assert.equal(baselinePageVisible({ role: "RECRUITER" }, "account"), true);
  assert.equal(baselinePageVisible({ role: "RECRUITER" }, "home"), false);
  assert.equal(baselinePageVisible({ role: "RECRUITER" }, "operatori"), false);
});

test("standaloneOperatoreRoles: entrambi add-on", () => {
  const ctx = getProductStandaloneContext(modulesFromPackages(["legal-ai", "recruiting"]));
  assert.deepEqual(standaloneOperatoreRoles(ctx), ["RECRUITER", "AVVOCATO"]);
});
