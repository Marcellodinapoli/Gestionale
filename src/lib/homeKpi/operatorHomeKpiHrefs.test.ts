import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hrefPraticheAffidateHome,
  hrefPraticheInScadenza7ggHome,
  hrefPraticheScaduteHome,
} from "./operatorHomeKpiHrefs";

test("href home operatore aprono Pratiche con cerca=1", () => {
  assert.match(hrefPraticheAffidateHome(), /\/pratiche\?.*cerca=1/);
  assert.match(hrefPraticheScaduteHome(), /stato=SCADUTA/);
});

test("href scadenza 7 gg: intervallo date in query", () => {
  const href = hrefPraticheInScadenza7ggHome(new Date(2026, 9, 25));
  assert.match(href, /scadenzaDa=2026-10-25/);
  assert.match(href, /scadenzaA=2026-11-01/);
});
