import { test } from "node:test";
import assert from "node:assert/strict";
import {
  affidiPraticaInFaseGiudiziale,
  affidiPraticaInFaseGiudizialeAffidiCard,
  affidiPraticaInLavorazioneStragiudizialeAffidi,
  affidiPraticaScadutaPerSupervisor,
  isPraticaDaAffidareGruppoHome,
  isPraticaGiudizialeDaAffidareAffidi,
  visibileInElencoAffidiSupervisor,
} from "./affidiPraticaStatoUi";

test("supervisor: da affidare esclude mandato scaduto senza affidatario", () => {
  const p = {
    stato: "NUOVA",
    assegnatarioId: null,
    scadenza: new Date(2020, 0, 1),
    conferimentoTipo: "STRAGIUDIZIALE",
  };
  assert.equal(affidiPraticaScadutaPerSupervisor(p), true);
  assert.equal(visibileInElencoAffidiSupervisor(p), false);
});

test("supervisor: da affidare include aperta non scaduta senza affidatario", () => {
  const p = {
    stato: "NUOVA",
    assegnatarioId: null,
    scadenza: new Date(2030, 5, 1),
    conferimentoTipo: "ENTRAMBI",
  };
  assert.equal(affidiPraticaScadutaPerSupervisor(p), false);
  assert.equal(visibileInElencoAffidiSupervisor(p), true);
});

test("home da affidare: esclude scadute senza affidatario", () => {
  assert.equal(
    isPraticaDaAffidareGruppoHome({
      stato: "NUOVA",
      assegnatarioId: null,
      scadenza: new Date(2020, 0, 1),
      conferimentoTipo: "STRAGIUDIZIALE",
    }),
    false
  );
});

test("home da affidare: include aperta non scaduta senza affidatario", () => {
  assert.equal(
    isPraticaDaAffidareGruppoHome({
      stato: "NUOVA",
      assegnatarioId: null,
      scadenza: new Date(2030, 5, 1),
      conferimentoTipo: "ENTRAMBI",
    }),
    true
  );
});

test("affidi: in fase giudiziale con stato attività", () => {
  const base = {
    stato: "IN_LAVORAZIONE",
    assegnatarioId: "op-1",
    statoAvvioGiudiziale: "IN_PROCEDURA",
  };
  assert.equal(affidiPraticaInFaseGiudiziale(base), true);
  assert.equal(isPraticaGiudizialeDaAffidareAffidi(base), false);
  assert.equal(
    isPraticaGiudizialeDaAffidareAffidi({ ...base, assegnatarioId: null }),
    true
  );
});

test("affidi: bozza giudiziale non conta in fase giudiziale", () => {
  assert.equal(
    affidiPraticaInFaseGiudiziale({
      stato: "NUOVA",
      statoAvvioGiudiziale: "BOZZA",
    }),
    false
  );
});

test("affidi: stragiudiziale in lavorazione esclude scaduta stragiudiziale senza affidatario", () => {
  const scadutaGiudiziale = {
    stato: "IN_LAVORAZIONE",
    assegnatarioId: null,
    scadenza: new Date(2030, 0, 1),
    dataPassaggioGiudiziale: new Date(2020, 0, 1),
    conferimentoTipo: "ENTRAMBI",
  };
  assert.equal(affidiPraticaScadutaPerSupervisor(scadutaGiudiziale), true);
  assert.equal(affidiPraticaInLavorazioneStragiudizialeAffidi(scadutaGiudiziale), false);
  assert.equal(affidiPraticaInFaseGiudizialeAffidiCard(scadutaGiudiziale), true);
  assert.equal(isPraticaGiudizialeDaAffidareAffidi(scadutaGiudiziale), true);
});
