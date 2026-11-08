import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avvisoAgendaNelPassato,
  MSG_AGENDA_NEL_PASSATO,
} from "./agendaNonNelPassato";

test("agenda nel passato: avviso se data/ora precedente a ora", () => {
  const now = new Date(2026, 9, 25, 14, 30, 0);
  const past = new Date(2026, 9, 25, 14, 29, 0);
  assert.equal(avvisoAgendaNelPassato(past, now), MSG_AGENDA_NEL_PASSATO);
  assert.equal(avvisoAgendaNelPassato(new Date(2026, 9, 25, 14, 30, 0), now), null);
  assert.equal(avvisoAgendaNelPassato(new Date(2026, 9, 25, 15, 0, 0), now), null);
});
