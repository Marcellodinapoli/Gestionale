import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deveDeaffidarePerScadenzaStragiudiziale,
  isPerimetroStragiudizialePoiGiudiziale,
} from "./deaffidoScadenzaStragiudiziale";

test("perimetro stragiudiziale poi giudiziale solo su ENTRAMBI", () => {
  assert.equal(isPerimetroStragiudizialePoiGiudiziale("ENTRAMBI"), true);
  assert.equal(isPerimetroStragiudizialePoiGiudiziale("STRAGIUDIZIALE"), false);
  assert.equal(isPerimetroStragiudizialePoiGiudiziale("GIUDIZIALE"), false);
});

test("deaffido: giorno della scadenza stragiudiziale ancora affidato", () => {
  const scadenza = new Date(2026, 9, 24);
  const now = new Date(2026, 9, 24, 15, 0, 0);
  assert.equal(
    deveDeaffidarePerScadenzaStragiudiziale(
      {
        conferimentoTipo: "ENTRAMBI",
        scadenza,
        assegnatarioId: "op-1",
        stato: "IN_LAVORAZIONE",
      },
      now
    ),
    false
  );
});

test("deaffido: dal giorno dopo la scadenza stragiudiziale", () => {
  const scadenza = new Date(2026, 9, 24);
  const now = new Date(2026, 9, 25, 8, 0, 0);
  assert.equal(
    deveDeaffidarePerScadenzaStragiudiziale(
      {
        conferimentoTipo: "ENTRAMBI",
        scadenza,
        assegnatarioId: "op-1",
        stato: "IN_LAVORAZIONE",
      },
      now
    ),
    true
  );
});

test("deaffido: usa dataPassaggioGiudiziale se valorizzata", () => {
  const passaggio = new Date(2026, 9, 20);
  const now = new Date(2026, 9, 21);
  assert.equal(
    deveDeaffidarePerScadenzaStragiudiziale(
      {
        conferimentoTipo: "ENTRAMBI",
        scadenza: new Date(2026, 11, 1),
        dataPassaggioGiudiziale: passaggio,
        assegnatarioId: "op-1",
        stato: "IN_LAVORAZIONE",
      },
      now
    ),
    true
  );
});
