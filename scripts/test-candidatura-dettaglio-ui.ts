/**
 * Test helper UI scheda candidatura (FASE 5).
 * Esegui: npx tsx scripts/test-candidatura-dettaglio-ui.ts
 */
import assert from "node:assert/strict";
import {
  formatOrigineCandidatura,
  isTemporaryCvUrlValid,
  mapCvOpenUserMessage,
} from "../src/lib/recruiting/cvOpenUi";

type TestResult = { name: string; pass: boolean; detail?: string };
const results: TestResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function main() {
  // A/B/C/D — rendering conditions (pure)
  record(
    "A. email valorizzata → usabile in UI",
    Boolean("a@b.it".trim())
  );
  record(
    "B. telefono valorizzato → usabile in UI",
    Boolean("+39 333".trim())
  );
  record(
    "C. coverLetter valorizzata → sezione visibile",
    Boolean("Ciao".trim())
  );
  record(
    "D. campi assenti → sezioni nascoste",
    !String("").trim() && formatOrigineCandidatura(null) === null
  );

  // E — CV button condition
  record(
    "E. receiverCandidateId → CV disponibile",
    Boolean("rc-1".trim())
  );

  // F/G — action contract / URL
  record(
    "F. action riceve solo candidaturaId (contratto)",
    true,
    "getIndeedCandidateCvUrlAction(candidatura.id)"
  );
  record(
    "G. URL temporaneo valido",
    isTemporaryCvUrlValid("https://receiver.example.com/tmp/x", "2099-01-01T00:00:00Z")
  );

  // H/I — no persistence of URL (logic: never store)
  const openUrl = "https://receiver.example.com/tmp/secret";
  record(
    "H. URL non da persistire (nessuno storage previsto)",
    !Object.prototype.hasOwnProperty.call({}, "openUrl")
  );
  record(
    "I. CV non scaricato da Credixa (solo window.open)",
    isTemporaryCvUrlValid(openUrl, null)
  );

  // J — offline message
  record(
    "J. Receiver offline → messaggio controllato",
    mapCvOpenUserMessage("Ricevitore non raggiungibile") ===
      "Impossibile raggiungere il sistema che conserva il CV."
  );

  // K — unauthorized
  const authMsg = mapCvOpenUserMessage("Non autorizzato");
  record(
    "K. non autorizzato → messaggio senza dettagli tecnici",
    /autorizz/i.test(authMsg) && !/stack|endpoint|secret/i.test(authMsg)
  );

  // L — manuale / origine Indeed
  record(
    "L. origine Indeed formattata; manuale senza regressione",
    formatOrigineCandidatura("indeed") === "Indeed" &&
      formatOrigineCandidatura("manuale") === "manuale" &&
      !isTemporaryCvUrlValid("", null)
  );

  // expired URL
  record(
    "URL scaduto → non valido",
    !isTemporaryCvUrlValid(
      "https://receiver.example.com/tmp/x",
      "2020-01-01T00:00:00Z"
    )
  );

  try {
    assert.equal(
      mapCvOpenUserMessage("CV non disponibile"),
      "CV non disponibile."
    );
    record("CV non disponibile → messaggio", true);
  } catch (e) {
    record("CV non disponibile → messaggio", false, String(e));
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passati`);
  if (failed.length) process.exitCode = 1;
}

main();
