import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canExportDraft,
  canGenerateDraft,
  generateDraftText,
  runMockLegalSearch,
  runMockRevision,
} from "./draftPipeline";
import { parseLegalAiSession } from "./sessionStorage";

test("generateDraftText: richiede oggetto e include tipologia", () => {
  const text = generateDraftText({
    actTypeId: "atto-citazione",
    intake: {
      oggetto: "Risarcimento danni",
      sintesiFatti: "Sinistro stradale",
      richieste: "Condanna al pagamento",
    },
  });
  assert.match(text, /ATTO DI CITAZIONE/i);
  assert.match(text, /Risarcimento danni/);
  assert.match(text, /Sinistro stradale/);
});

test("canGenerateDraft: oggetto obbligatorio", () => {
  assert.equal(
    canGenerateDraft({
      actTypeId: "diffida",
      intake: { oggetto: "", sintesiFatti: "x", richieste: "" },
    }),
    false
  );
  assert.equal(
    canGenerateDraft({
      actTypeId: "diffida",
      intake: { oggetto: "Adempimento", sintesiFatti: "", richieste: "" },
    }),
    true
  );
});

test("runMockLegalSearch: query non vuota", () => {
  assert.equal(runMockLegalSearch("", "atto-citazione").length, 0);
  assert.ok(runMockLegalSearch("2043", "atto-citazione").length >= 1);
});

test("runMockRevision: bozza non vuota", () => {
  assert.equal(runMockRevision("").length, 0);
  assert.ok(runMockRevision("Testo breve").length >= 2);
});

test("canExportDraft", () => {
  assert.equal(canExportDraft({ draftText: "  " }), false);
  assert.equal(canExportDraft({ draftText: "Bozza" }), true);
});

test("parseLegalAiSession: versione e campi", () => {
  const s = parseLegalAiSession(
    JSON.stringify({
      version: 1,
      actTypeId: "ricorso",
      intake: { oggetto: "a", sintesiFatti: "b", richieste: "c" },
      draftText: "d",
      searchQuery: "q",
      searchResults: [],
      revisionItems: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  assert.equal(s.actTypeId, "ricorso");
  assert.equal(s.intake.oggetto, "a");
});
