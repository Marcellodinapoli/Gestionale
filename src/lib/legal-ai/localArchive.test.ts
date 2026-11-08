import { test } from "node:test";
import assert from "node:assert/strict";
import {
  archiveEntryLabel,
  createArchiveEntryFromSession,
  legalAiArchiveStorageKey,
  parseArchiveEntries,
  serializeArchiveEntries,
} from "./localArchive";
import { createEmptyLegalAiSession } from "./sessionTypes";

test("storage keys per tenant e utente", () => {
  const scope = { tenantId: "t1", userId: "u1" };
  assert.match(legalAiArchiveStorageKey(scope), /t1-u1/);
});

test("archiveEntryLabel preferisce oggetto", () => {
  const s = createEmptyLegalAiSession();
  s.actTypeId = "ricorso";
  s.intake.oggetto = "Opposizione decreto";
  assert.equal(archiveEntryLabel(s), "Opposizione decreto");
});

test("parseArchiveEntries roundtrip", () => {
  const session = createEmptyLegalAiSession();
  session.actTypeId = "diffida";
  session.draftText = "Testo";
  session.intake.oggetto = "Adempimento";
  const entry = createArchiveEntryFromSession(session, "id-1");
  const raw = serializeArchiveEntries([entry]);
  const back = parseArchiveEntries(raw);
  assert.equal(back.length, 1);
  assert.equal(back[0]?.id, "id-1");
  assert.equal(back[0]?.session.draftText, "Testo");
});
