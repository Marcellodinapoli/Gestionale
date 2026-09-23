/**
 * Smoke test predisposizione piattaforma (nessuna dipendenza server).
 * Esegui: npx tsx scripts/smoke-platform-modules.ts
 */
import {
  FUTURE_MODULE_IDS,
  hasModule,
  NEW_PRODUCT_MODULE_IDS,
  parseEnabledModules,
  RECOVERY_DEFAULT_MODULES,
  SELLABLE_MODULE_IDS,
  serializeEnabledModules,
} from "../src/lib/platform/modules";
import {
  CODICI_SCARICO,
  STATO_LABELS,
} from "../src/lib/platform/catalogs/recovery";

const expectedStati = [
  "NUOVA",
  "AFFIDATA",
  "IN_LAVORAZIONE",
  "SCADUTA",
  "PROMESSA",
  "PIANO",
  "INCASSO",
  "INESIGIBILE",
  "RESA",
];
const expectedCodici = ["PTC", "PPC", "MOV", "LPP", "LPT"];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  RECOVERY_DEFAULT_MODULES.join(",") ===
    "core,recovery,incassi,dialer,affidi,lavorazione,legale,formazione,recruiting,strumenti",
  "default modules"
);
for (const m of RECOVERY_DEFAULT_MODULES) {
  assert(hasModule(undefined, m), `default has ${m}`);
}
for (const m of SELLABLE_MODULE_IDS) {
  assert(hasModule(undefined, m), `sellable ${m} on by default`);
}
for (const m of FUTURE_MODULE_IDS) {
  assert(!hasModule(undefined, m), `future ${m} off by default`);
  assert(!hasModule(RECOVERY_DEFAULT_MODULES, m), `recovery list excludes ${m}`);
}

const v1 = parseEnabledModules(
  JSON.stringify(["core", "recovery", "incassi", "dialer", "affidi", "lavorazione"])
);
for (const m of NEW_PRODUCT_MODULE_IDS) {
  assert(v1.includes(m), `v1 keeps ${m}`);
}

const v2 = parseEnabledModules(serializeEnabledModules(["core", "formazione"]));
assert(v2.includes("core"), "v2 keeps core");
assert(v2.includes("formazione"), "v2 keeps formazione");
assert(!v2.includes("legale"), "v2 can turn off legale");
assert(!v2.includes("recovery"), "v2 can turn off recovery");

assert(
  expectedStati.every((s) => STATO_LABELS[s]),
  "STATO_LABELS keys"
);
assert(
  expectedCodici.every((c) => (CODICI_SCARICO as readonly string[]).includes(c)),
  "CODICI_SCARICO"
);

console.log("smoke-platform-modules: OK");
