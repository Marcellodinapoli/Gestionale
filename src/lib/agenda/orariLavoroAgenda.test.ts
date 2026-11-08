import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGENDA_MINUTI_LAVORO,
  AGENDA_ORE_LAVORO,
  clampAgendaHour,
  roundAgendaMinute,
} from "./orariLavoroAgenda";

test("ore agenda: 09–21", () => {
  assert.deepEqual(AGENDA_ORE_LAVORO, [
    9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  ]);
  assert.equal(clampAgendaHour(0), 9);
  assert.equal(clampAgendaHour(22), 21);
  assert.equal(clampAgendaHour(15), 15);
});

test("minuti agenda: multipli di 5", () => {
  assert.deepEqual(AGENDA_MINUTI_LAVORO, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  assert.equal(roundAgendaMinute(3), 5);
  assert.equal(roundAgendaMinute(2), 0);
  assert.equal(roundAgendaMinute(58), 55);
});
