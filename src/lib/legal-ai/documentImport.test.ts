import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractLegalAiDocumentText,
  legalAiDocumentPreview,
} from "./documentImport";
import { runMockAiEditDraft } from "./draftPipeline";

test("extractLegalAiDocumentText: txt", async () => {
  const file = {
    name: "atto.txt",
    size: 10,
    text: async () => "  Contenuto atto  ",
    arrayBuffer: async () => new ArrayBuffer(0),
  };
  const r = await extractLegalAiDocumentText(file);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.text, "Contenuto atto");
});

test("extractLegalAiDocumentText: rifiuta pdf", async () => {
  const file = {
    name: "doc.pdf",
    size: 100,
    text: async () => "",
    arrayBuffer: async () => new ArrayBuffer(0),
  };
  const r = await extractLegalAiDocumentText(file);
  assert.equal(r.ok, false);
});

test("legalAiDocumentPreview: tronca", () => {
  const long = "a".repeat(600);
  assert.ok(legalAiDocumentPreview(long).endsWith("…"));
});

test("runMockAiEditDraft: richiede istruzione e testo", () => {
  assert.equal(runMockAiEditDraft({ draftText: "Bozza", instruction: "" }), "Bozza");
  const out = runMockAiEditDraft({
    draftText: "Paragrafo uno.\nParagrafo due.",
    instruction: "Migliora la forma",
    sourceFileName: "memoria.docx",
  });
  assert.match(out, /Documento di partenza: memoria\.docx/);
  assert.match(out, /Migliora la forma/);
});
