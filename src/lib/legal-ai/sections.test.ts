import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGAL_AI_SECTIONS,
  LEGAL_AI_WORKFLOW_STEPS,
  legalAiWorkflowNeighbors,
  resolveLegalAiSectionFromPath,
} from "./sections";

test("Legal AI: sei sezioni con percorsi sotto /legal-ai", () => {
  assert.equal(LEGAL_AI_SECTIONS.length, 6);
  assert.equal(LEGAL_AI_SECTIONS[0]?.href, "/legal-ai");
  assert.ok(LEGAL_AI_SECTIONS.every((s) => s.href.startsWith("/legal-ai")));
});

test("Legal AI: flusso redazione in cinque passi", () => {
  assert.deepEqual(LEGAL_AI_WORKFLOW_STEPS, [
    "nuovoAtto",
    "redazione",
    "ricerca",
    "revisione",
    "esportazione",
  ]);
});

test("resolveLegalAiSectionFromPath: home e sottosezioni", () => {
  assert.equal(resolveLegalAiSectionFromPath("/legal-ai"), "home");
  assert.equal(resolveLegalAiSectionFromPath("/legal-ai/"), "home");
  assert.equal(resolveLegalAiSectionFromPath("/legal-ai/nuovo-atto"), "nuovoAtto");
  assert.equal(resolveLegalAiSectionFromPath("/legal-ai/esportazione"), "esportazione");
});

test("legalAiWorkflowNeighbors: catena passi", () => {
  assert.deepEqual(legalAiWorkflowNeighbors("nuovoAtto"), {
    prev: null,
    next: "redazione",
  });
  assert.deepEqual(legalAiWorkflowNeighbors("redazione"), {
    prev: "nuovoAtto",
    next: "ricerca",
  });
  assert.deepEqual(legalAiWorkflowNeighbors("esportazione"), {
    prev: "revisione",
    next: null,
  });
});
