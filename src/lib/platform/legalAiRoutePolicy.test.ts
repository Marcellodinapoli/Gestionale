import { test } from "node:test";
import assert from "node:assert/strict";
import { hasModule, modulesFromPackages, RECOVERY_DEFAULT_MODULES } from "./modules";
import { homeEntryRedirectWithoutRecovery } from "./homeEntryRedirect";
import { evaluateLegalAiPageAccess } from "./legalAiPageAccess";
import { resolveLegalAiPageGuardOutcome } from "./legalAiPageAccess";
import type { TenantPlatformConfig } from "./modules";
import { can, type Role } from "@/lib/permissions";
import {
  baselinePageVisible,
  resolveEffectiveNavVisibility,
} from "@/lib/navVisibility/defaults";

function platformFromPackages(packages: string[]): TenantPlatformConfig {
  return {
    verticalProfile: "RECUPERO_CREDITI",
    enabledModules: modulesFromPackages(packages),
  };
}

function defaultRecoveryPlatform(): TenantPlatformConfig {
  return {
    verticalProfile: "RECUPERO_CREDITI",
    enabledModules: [...RECOVERY_DEFAULT_MODULES],
  };
}

function legalAiNavVisible(
  role: Role,
  opts?: { roleDefaults?: { legalAi?: boolean } }
): boolean {
  return resolveEffectiveNavVisibility({
    role,
    formazioneOnly: false,
    roleDefaults: opts?.roleDefaults
      ? { [role]: { legalAi: opts.roleDefaults.legalAi } }
      : undefined,
  }).legalAi;
}

test("tenant senza legal-ai: accesso pagina negato (gate modulo)", () => {
  const platform = defaultRecoveryPlatform();
  const visible = legalAiNavVisible("AVVOCATO");
  assert.equal(visible, true);
  const decision = evaluateLegalAiPageAccess({
    platform,
    legalAiNavVisible: visible,
  });
  assert.equal(decision.allowed, false);
  if (decision.allowed) assert.fail("expected deny");
  assert.equal(decision.reason, "module");
});

test("tenant con pacchetto legal-ai e AVVOCATO: accesso pagina consentito", () => {
  const platform = platformFromPackages(["legal-ai"]);
  const visible = legalAiNavVisible("AVVOCATO");
  assert.equal(visible, true);
  const decision = evaluateLegalAiPageAccess({ platform, legalAiNavVisible: visible });
  assert.equal(decision.allowed, true);
});

test("tenant con legal-ai ma utente senza voce menu (OPERATOR): negato lato nav", () => {
  const platform = platformFromPackages(["legal-ai"]);
  assert.equal(can({ role: "OPERATOR" }, "legal-ai:view"), false);
  const visible = legalAiNavVisible("OPERATOR");
  assert.equal(visible, false);
  const decision = evaluateLegalAiPageAccess({ platform, legalAiNavVisible: visible });
  assert.equal(decision.allowed, false);
  if (decision.allowed) assert.fail("expected deny");
  assert.equal(decision.reason, "nav");
});

test("Home: tenant solo legal-ai reindirizza a /legal-ai", () => {
  const platform = platformFromPackages(["legal-ai"]);
  assert.equal(hasModule(platform.enabledModules, "recovery"), false);
  assert.equal(hasModule(platform.enabledModules, "legal-ai"), true);
  assert.equal(homeEntryRedirectWithoutRecovery(platform), "/legal-ai");
});

test("Home: tenant recovery default non reindirizza ad add-on", () => {
  const platform = defaultRecoveryPlatform();
  assert.equal(homeEntryRedirectWithoutRecovery(platform), null);
});

test("Home: legal-ai ha priorità su legale se entrambi accesi senza recovery", () => {
  const platform: TenantPlatformConfig = {
    verticalProfile: "RECUPERO_CREDITI",
    enabledModules: ["core", "legal-ai", "legale"],
  };
  assert.equal(homeEntryRedirectWithoutRecovery(platform), "/legal-ai");
});

test("LEGAL non ha legal-ai:view; AVVOCATO sì (permesso ruolo)", () => {
  assert.equal(can({ role: "LEGAL" }, "legal-ai:view"), false);
  assert.equal(can({ role: "AVVOCATO" }, "legal-ai:view"), true);
  assert.equal(baselinePageVisible({ role: "LEGAL" }, "legalAi"), false);
  assert.equal(baselinePageVisible({ role: "AVVOCATO" }, "legalAi"), true);
});

test("AVVOCATO con permesso ma voce legalAi nascosta in matrice: accesso negato (nav)", () => {
  const platform = platformFromPackages(["legal-ai"]);
  assert.equal(can({ role: "AVVOCATO" }, "legal-ai:view"), true);
  const visible = legalAiNavVisible("AVVOCATO", { roleDefaults: { legalAi: false } });
  assert.equal(visible, false);
  const decision = evaluateLegalAiPageAccess({ platform, legalAiNavVisible: visible });
  assert.equal(decision.allowed, false);
  if (decision.allowed) assert.fail("expected deny");
  assert.equal(decision.reason, "nav");
});

test("resolveLegalAiPageGuardOutcome: attivazione sezioni prima del modulo", () => {
  const platform: TenantPlatformConfig = {
    verticalProfile: "RECUPERO_CREDITI",
    enabledModules: ["core"],
  };
  assert.deepEqual(resolveLegalAiPageGuardOutcome({ platform, legalAiNavVisible: true }), {
    status: "redirect",
    target: "/attivazione-sezioni",
  });
});

test("resolveLegalAiPageGuardOutcome: modulo assente → /account", () => {
  const platform = defaultRecoveryPlatform();
  assert.deepEqual(
    resolveLegalAiPageGuardOutcome({
      platform,
      legalAiNavVisible: true,
    }),
    { status: "redirect", target: "/account" }
  );
});

test("resolveLegalAiPageGuardOutcome: tenant legal-ai e nav visibile → allow", () => {
  const platform = platformFromPackages(["legal-ai"]);
  assert.deepEqual(
    resolveLegalAiPageGuardOutcome({
      platform,
      legalAiNavVisible: true,
    }),
    { status: "allow" }
  );
});

test("resolveLegalAiPageGuardOutcome: modulo ok ma nav nascosta → nav-hidden", () => {
  const platform = platformFromPackages(["legal-ai"]);
  assert.deepEqual(
    resolveLegalAiPageGuardOutcome({
      platform,
      legalAiNavVisible: false,
    }),
    { status: "redirect", target: "nav-hidden" }
  );
});
