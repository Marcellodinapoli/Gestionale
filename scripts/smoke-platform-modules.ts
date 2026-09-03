/**
 * Smoke test predisposizione piattaforma (nessuna dipendenza server).
 * Esegui: npx tsx scripts/smoke-platform-modules.ts
 */
import {
  FUTURE_MODULE_IDS,
  hasModule,
  RECOVERY_DEFAULT_MODULES,
} from "../src/lib/platform/modules";
import {
  CODICI_SCARICO,
  STATO_LABELS,
} from "../src/lib/platform/catalogs/recovery";

const expectedStati = [
  "NUOVA",
  "AFFIDATA",
  "IN_LAVORAZIONE",
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
    "core,recovery,incassi,dialer,affidi,lavorazione",
  "default modules"
);
for (const m of RECOVERY_DEFAULT_MODULES) {
  assert(hasModule(undefined, m), `default has ${m}`);
}
for (const m of FUTURE_MODULE_IDS) {
  assert(!hasModule(undefined, m), `future ${m} off by default`);
  assert(!hasModule(RECOVERY_DEFAULT_MODULES, m), `recovery list excludes ${m}`);
}
assert(
  expectedStati.every((s) => STATO_LABELS[s]),
  "STATO_LABELS keys"
);
assert(
  expectedCodici.every((c) => (CODICI_SCARICO as readonly string[]).includes(c)),
  "CODICI_SCARICO"
);

console.log("smoke-platform-modules: OK");
