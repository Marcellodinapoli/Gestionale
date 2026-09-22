/**
 * Test mapper Indeed Apply (FASE 2).
 * Esegui: npx tsx scripts/test-indeed-apply-mapper.ts
 *
 * Nessuna HTTP / DB reale: lookup offerta mockato.
 */
import assert from "node:assert/strict";
import type { OffertaLavoroRecord } from "../src/lib/recruiting/offerte";
import type { IndeedApplyApplication } from "../src/lib/recruiting/indeedApply";
import { IndeedApplyMappingError } from "../src/lib/recruiting/indeedApply";
import {
  extractIndeedApplyResumeMeta,
  mapIndeedApplyToCandidaturaUpsert,
} from "../src/lib/recruiting/indeedApplyMapper";

type TestResult = { name: string; pass: boolean; detail?: string };
const results: TestResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function expectError(
  name: string,
  code: string,
  fn: () => Promise<unknown>
) {
  try {
    await fn();
    record(name, false, "nessun errore");
  } catch (e) {
    const ok =
      e instanceof IndeedApplyMappingError && e.code === code;
    record(name, ok, ok ? code : String(e));
  }
}

const OFFERTE: OffertaLavoroRecord[] = [
  {
    id: "off-tenant-a",
    tenantId: "tenant-a",
    titolo: "Dev",
    luogo: "Roma",
    modalitaLavoro: "REMOTO",
    tipoContratto: "TEMPO_INDETERMINATO",
    orario: "FULL_TIME",
    numeroPosizioni: 1,
    descrizione: "",
    attivitaPrincipali: "",
    requisiti: "",
    competenze: "",
    retribuzione: "",
    benefit: "",
    paese: "IT",
    stato: "PUBBLICATA",
    indeedJobId: "indeed-job-111",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function mockFind(tenantId: string, indeedJobId: string) {
  return (
    OFFERTE.find(
      (o) => o.tenantId === tenantId && o.indeedJobId === indeedJobId
    ) ?? null
  );
}

const deps = { findOffertaByIndeedJobId: mockFind };

const validPayload: IndeedApplyApplication = {
  applicationId: "app-123",
  jobId: "indeed-job-111",
  firstName: "Mario",
  lastName: "Rossi",
  email: "mario.rossi@example.com",
  emailVerified: true,
  phoneNumber: "+39 333 1234567",
  coverletter: "Sono interessato.",
  resume: {
    present: true,
    fileName: "cv-mario.pdf",
    contentType: "application/pdf",
    documentId: "doc-cv-9",
    receiverDocumentRef: "receiver://docs/doc-cv-9",
  },
  screenerQuestions: [{ id: "q1", question: "Esperienza?", answer: "5 anni" }],
  jobMeta: { title: "Dev" },
  source: "indeed",
  analytics: { campaign: "organic" },
};

async function main() {
  // A — payload valido
  try {
    const mapped = await mapIndeedApplyToCandidaturaUpsert(
      validPayload,
      { tenantId: "tenant-a" },
      deps
    );
    assert.equal(mapped.upsert.externalApplicationId, "app-123");
    assert.equal(mapped.upsert.offertaId, "off-tenant-a");
    assert.equal(mapped.upsert.nome, "Mario");
    assert.equal(mapped.upsert.cognome, "Rossi");
    assert.equal(mapped.upsert.email, "mario.rossi@example.com");
    assert.equal(mapped.upsert.emailVerified, true);
    assert.equal(mapped.upsert.phone, "+39 333 1234567");
    assert.equal(mapped.upsert.coverLetter, "Sono interessato.");
    assert.equal(mapped.upsert.source, "indeed");
    assert.equal(mapped.resumeMeta?.documentId, "doc-cv-9");
    assert.equal(mapped.resumeMeta?.fileName, "cv-mario.pdf");
    // nessun campo CV nel persistente
    assert.ok(!("resume" in mapped.upsert));
    assert.ok(!("coverletter" in mapped.upsert));
    record("A. payload valido → mapping corretto", true);
  } catch (e) {
    record("A. payload valido → mapping corretto", false, String(e));
  }

  // B — applicationId mancante
  await expectError(
    "B. applicationId mancante → errore",
    "MISSING_APPLICATION_ID",
    () =>
      mapIndeedApplyToCandidaturaUpsert(
        { ...validPayload, applicationId: "" },
        { tenantId: "tenant-a" },
        deps
      )
  );

  // C — jobId mancante
  await expectError(
    "C. jobId mancante → errore",
    "MISSING_JOB_ID",
    () =>
      mapIndeedApplyToCandidaturaUpsert(
        { ...validPayload, jobId: null },
        { tenantId: "tenant-a" },
        deps
      )
  );

  // D — jobId inesistente
  await expectError(
    "D. jobId inesistente → errore",
    "OFFERTA_NOT_FOUND",
    () =>
      mapIndeedApplyToCandidaturaUpsert(
        { ...validPayload, jobId: "job-sconosciuto" },
        { tenantId: "tenant-a" },
        deps
      )
  );

  // E — jobId di altro tenant
  await expectError(
    "E. jobId altro tenant → OFFERTA_NOT_FOUND",
    "OFFERTA_NOT_FOUND",
    () =>
      mapIndeedApplyToCandidaturaUpsert(
        validPayload,
        { tenantId: "tenant-b" },
        deps
      )
  );

  // F — CV: solo metadati, nessun contenuto
  try {
    const dirty = {
      ...validPayload,
      resume: {
        present: true,
        fileName: "cv.pdf",
        contentType: "application/pdf",
        documentId: "d1",
        // campi vietati se presenti per errore nel payload grezzo
        data: "BASE64_SHOULD_NOT_LEAK",
        content: "BINARY",
        resumeText: "testo cv",
        resumeHtml: "<p>cv</p>",
        resumeJson: { skills: [] },
      } as IndeedApplyApplication["resume"],
    };
    const mapped = await mapIndeedApplyToCandidaturaUpsert(
      dirty,
      { tenantId: "tenant-a" },
      deps
    );
    const meta = extractIndeedApplyResumeMeta(dirty.resume);
    assert.equal(meta?.fileName, "cv.pdf");
    assert.equal(meta?.documentId, "d1");
    const metaJson = JSON.stringify(mapped.resumeMeta);
    assert.ok(!metaJson.includes("BASE64"));
    assert.ok(!metaJson.includes("resumeText"));
    assert.ok(!metaJson.includes("resumeHtml"));
    assert.ok(!("data" in (mapped.resumeMeta as object)));
    assert.ok(!("resumeText" in (mapped.upsert as object)));
    record("F. CV → solo metadati, no contenuto file", true);
  } catch (e) {
    record("F. CV → solo metadati, no contenuto file", false, String(e));
  }

  // G — email/telefono/cover letter assenti
  try {
    const mapped = await mapIndeedApplyToCandidaturaUpsert(
      {
        applicationId: "app-456",
        jobId: "indeed-job-111",
        firstName: "Anna",
        lastName: "Bianchi",
      },
      { tenantId: "tenant-a" },
      deps
    );
    assert.equal(mapped.upsert.email, null);
    assert.equal(mapped.upsert.phone, null);
    assert.equal(mapped.upsert.coverLetter, null);
    assert.equal(mapped.upsert.nome, "Anna");
    assert.equal(mapped.upsert.cognome, "Bianchi");
    record("G. email/telefono/cover assenti → mapping valido", true);
  } catch (e) {
    record("G. email/telefono/cover assenti → mapping valido", false, String(e));
  }

  // tenantId mancante
  await expectError(
    "tenantId mancante → errore",
    "MISSING_TENANT_ID",
    () =>
      mapIndeedApplyToCandidaturaUpsert(validPayload, { tenantId: "  " }, deps)
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passati`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
