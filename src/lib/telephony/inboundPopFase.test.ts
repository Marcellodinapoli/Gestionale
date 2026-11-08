import { test } from "node:test";
import assert from "node:assert/strict";
import { describeInboundPraticaFase } from "@/lib/telephony/inboundPopFase";

test("fase inbound: sezione legale con stato avvio", () => {
  const msg = describeInboundPraticaFase({
    stato: "APERTA",
    statoOperativo: "IN_LAVORAZIONE",
    statoAvvioGiudiziale: "IN_ATTESA_VALUTAZIONE_LEGALE",
  });
  assert.match(msg, /sezione legale/i);
  assert.match(msg, /valutazione legale/i);
});

test("fase inbound: stragiudiziale scaduta", () => {
  const msg = describeInboundPraticaFase({
    stato: "APERTA",
    statoOperativo: "SCADUTA",
    scadenza: new Date("2020-01-01"),
    conferimentoTipo: "STRAGIUDIZIALE",
  });
  assert.match(msg, /stragiudiziale scaduta/i);
});
