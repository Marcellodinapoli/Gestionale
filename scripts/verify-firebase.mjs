/**
 * Verifica collegamento Firebase Credixa ↔ creditform-d505d.
 * Uso: node scripts/verify-firebase.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

const expectedProject = "creditform-d505d";

function ok(msg) {
  console.log("OK  ", msg);
}
function fail(msg) {
  console.log("FAIL", msg);
}
function info(msg) {
  console.log("INFO", msg);
}

async function main() {
  console.log("=== Verifica Firebase Gestionale ===\n");

  const publicCfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missingPublic = Object.entries(publicCfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missingPublic.length) {
    fail(`Variabili client mancanti: ${missingPublic.join(", ")}`);
  } else {
    ok(`Config client presente (projectId=${publicCfg.projectId})`);
  }

  if (publicCfg.projectId === expectedProject) {
    ok(`Allineato a CreditCalc / CreditForm (${expectedProject})`);
  } else {
    fail(`projectId=${publicCfg.projectId}, atteso ${expectedProject}`);
  }

  const saPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    "./serviceAccountKey.json";
  const absolute = resolve(process.cwd(), saPath);
  info(`Service account path: ${absolute}`);

  if (!existsSync(absolute)) {
    fail("File service account NON trovato su questo PC");
    console.log(`
COSA FARE:
1. Apri https://console.firebase.google.com/project/${expectedProject}/settings/serviceaccounts/adminsdk
2. "Generate new private key"
3. Salva il file come:
   ${absolute}
4. Riesegui: node scripts/verify-firebase.mjs
`);
    process.exit(1);
  }

  let sa;
  try {
    sa = JSON.parse(readFileSync(absolute, "utf8"));
  } catch (e) {
    fail(`JSON service account non valido: ${e.message}`);
    process.exit(1);
  }

  if (!sa.private_key || !sa.client_email || !sa.project_id) {
    fail("Il file non sembra un service account Firebase (mancano campi chiave)");
    process.exit(1);
  }
  ok(`Service account: ${sa.client_email}`);

  if (sa.project_id !== expectedProject) {
    fail(`SA project_id=${sa.project_id}, atteso ${expectedProject}`);
    process.exit(1);
  }
  ok("Service account sul progetto corretto");

  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
      projectId: expectedProject,
    });
  }

  try {
    const list = await getAuth().listUsers(1);
    ok(`Auth raggiungibile (utenti campione: ${list.users.length})`);
  } catch (e) {
    fail(`Auth: ${e.message}`);
    process.exit(1);
  }

  try {
    const snap = await getFirestore().collection("users").limit(1).get();
    ok(`Firestore raggiungibile (users docs campione: ${snap.size})`);
  } catch (e) {
    fail(`Firestore: ${e.message}`);
    process.exit(1);
  }

  console.log("\n=== COLLEGAMENTO OK ===");
  console.log("Nota DB: Credixa continua su SQLite/Prisma; Firebase resta per Formazione/Store.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
