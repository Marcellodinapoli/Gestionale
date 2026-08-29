/**
 * Svuota Firestore Credixa e lascia solo tenant demo + admin di test.
 * Usa Firebase Admin direttamente (no Prisma).
 *
 * Uso: node scripts/reset-firebase-minimal.mjs
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";

const TENANT_COLLECTIONS = [
  "users",
  "sedi",
  "postazioni",
  "mandanti",
  "debitori",
  "debitoreRecapiti",
  "pratiche",
  "praticaLocks",
  "garanti",
  "garanteRecapiti",
  "fatture",
  "incassi",
  "attivita",
  "provvigioni",
  "documenti",
  "pianiRata",
  "messaggiAgenda",
  "impegniAgenda",
  "messaggiInterni",
  "configurazione",
  "registrazioni",
  "auditLogs",
  "passwordHistory",
  "importBatch",
  "_meta",
];

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    const candidates = [inline.replace(/^\uFEFF/, "")];
    if (inline.startsWith("'") && inline.endsWith("'")) candidates.push(inline.slice(1, -1));
    if (inline.startsWith('"') && inline.endsWith('"')) candidates.push(inline.slice(1, -1));
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (typeof parsed.private_key === "string") {
          parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        }
        return parsed;
      } catch {
        /* next */
      }
    }
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON non valido");
  }

  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    resolve(process.cwd(), "../backoffice/scripts/serviceAccountKey.json");

  const absolute = resolve(process.cwd(), filePath);
  if (!existsSync(absolute)) {
    throw new Error(`Service account non trovato: ${absolute}`);
  }
  return JSON.parse(readFileSync(absolute, "utf8"));
}

function cuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

async function deleteCollection(db, collectionRef, batchSize = 400) {
  while (true) {
    const snap = await collectionRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
  }
}

async function wipeTenant(db, tenantId) {
  const base = db.collection("credixa").doc(tenantId);
  for (const name of TENANT_COLLECTIONS) {
    await deleteCollection(db, base.collection(name));
  }
  await base.delete().catch(() => undefined);
}

async function main() {
  loadEnvFile();

  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({
      credential: cert(loadServiceAccount()),
      projectId: "creditform-d505d",
    });
  }

  const db = getFirestore();
  const tenantRefs = await db.collection("credixa").listDocuments();
  console.log(`Tenant da eliminare: ${tenantRefs.length}`);

  for (const ref of tenantRefs) {
    console.log("  elimino", ref.id);
    await wipeTenant(db, ref.id);
  }

  const tenantId = cuidLike();
  const sedeId = cuidLike();
  const userId = cuidLike();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash("Demo123!", 10);

  const tenant = {
    id: tenantId,
    slug: "demo",
    nome: "Demo",
    active: true,
    createdAt: now,
  };

  const sede = {
    id: sedeId,
    tenantId,
    nome: "Principale",
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const admin = {
    id: userId,
    tenantId,
    email: "admin@gestionale.local",
    name: "Admin",
    passwordHash,
    passwordChangedAt: now,
    role: "ADMIN",
    formazioneOnly: false,
    active: true,
    sedeId,
    createdAt: now,
    updatedAt: now,
  };

  await db.doc(`credixa/${tenantId}/_meta/tenant`).set(tenant);
  await db.doc(`credixa/${tenantId}/sedi/${sedeId}`).set(sede);
  await db.doc(`credixa/${tenantId}/users/${userId}`).set(admin);

  console.log("\n=== Firestore ripulito ===");
  console.log("Tenant: demo");
  console.log("Email:  admin@gestionale.local");
  console.log("Password: Demo123!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
