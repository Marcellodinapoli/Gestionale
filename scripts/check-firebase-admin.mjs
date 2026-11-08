/**
 * Verifica che il service account in .env possa creare custom token (Formazione).
 * Uso: npm run check:firebase
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    const parsed = JSON.parse(inline);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return { source: "FIREBASE_SERVICE_ACCOUNT_JSON", account: parsed };
  }
  const rel =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!rel) {
    throw new Error(
      "Imposta FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON in .env"
    );
  }
  const absolute = path.isAbsolute(rel) ? rel : path.join(root, rel);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File service account non trovato: ${absolute}`);
  }
  const account = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (typeof account.private_key === "string") {
    account.private_key = account.private_key.replace(/\\n/g, "\n");
  }
  return { source: absolute, account };
}

async function main() {
  const { source, account } = loadServiceAccount();
  console.log("Sorgente credenziali:", source);
  console.log("project_id:", account.project_id);
  console.log("client_email:", account.client_email);
  console.log("private_key_id:", account.private_key_id);

  for (const app of getApps()) {
    await deleteApp(app);
  }
  initializeApp({
    credential: cert(account),
    projectId: account.project_id,
  });

  const token = await getAuth().createCustomToken("credixa-check");
  console.log("createCustomToken: OK (lunghezza token", token.length + ")");
  console.log(
    "\nSe questo comando OK ma Formazione fallisce, riavvia completamente npm run dev."
  );
}

main().catch((e) => {
  console.error("createCustomToken: FALLITO");
  console.error(e?.message || e);
  if (/invalid_grant|JWT Signature/i.test(String(e?.message))) {
    console.error(
      "\n→ Chiave revocata o file non aggiornato dopo la rigenerazione in Firebase Console."
    );
    console.error(
      "  Scarica una nuova chiave e sostituisci serviceAccountKey.json (o FIREBASE_SERVICE_ACCOUNT_JSON), poi riprova."
    );
  }
  process.exit(1);
});
