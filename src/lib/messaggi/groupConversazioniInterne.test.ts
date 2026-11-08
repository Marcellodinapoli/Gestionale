import { test } from "node:test";
import assert from "node:assert/strict";
import { groupConversazioniInterne } from "./groupConversazioniInterne";
import type { MessaggioInternoSerialized } from "@/lib/messaggi/messaggioInternoUi";

const me = "u-me";
const pinco = "u-pinco";

function msg(
  partial: Partial<MessaggioInternoSerialized> & Pick<MessaggioInternoSerialized, "id" | "createdAt">
): MessaggioInternoSerialized {
  return {
    fromUserId: partial.fromUserId ?? pinco,
    toUserId: partial.toUserId ?? me,
    fromName: partial.fromName ?? "Pinco",
    toName: partial.toName ?? "Io",
    testo: partial.testo ?? "testo",
    letto: partial.letto ?? true,
    lettoAt: partial.lettoAt ?? null,
    praticaId: partial.praticaId ?? null,
    praticaNumero: partial.praticaNumero ?? null,
    debitore: partial.debitore ?? null,
    ...partial,
  };
}

test("groupConversazioniInterne: unisce inviato e ricevuto con stesso collega", () => {
  const items = [
    msg({
      id: "1",
      fromUserId: me,
      toUserId: pinco,
      fromName: "Io",
      toName: "Pinco",
      testo: "ciao",
      createdAt: "2026-10-20T10:00:00.000Z",
    }),
    msg({
      id: "2",
      fromUserId: pinco,
      toUserId: me,
      testo: "risposta",
      createdAt: "2026-10-25T12:00:00.000Z",
    }),
  ];

  const groups = groupConversazioniInterne(items, me);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].messaggi.length, 2);
  assert.equal(groups[0].messaggi[0].id, "1");
  assert.equal(groups[0].messaggi[1].id, "2");
  assert.equal(groups[0].controparteName, "Pinco");
});
