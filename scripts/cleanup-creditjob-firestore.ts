/**
 * One-shot: cancella dati CreditJob nativi su creditform-d505d.
 * Conserva job_offers con source === "gestionale" (sync Credixa).
 *
 * Uso (da root Gestionale, con .env):
 *   npx tsx scripts/cleanup-creditjob-firestore.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvPath(): string {
  const fromEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (fromEnv) return fromEnv;
  const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^\s*FIREBASE_SERVICE_ACCOUNT_PATH\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH mancante");
}

async function main() {
  const saPath = loadEnvPath();
  const absolute = resolve(process.cwd(), saPath);
  const sa = JSON.parse(readFileSync(absolute, "utf8"));

  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");

  if (!getApps().length) {
    initializeApp({
      credential: cert(sa as never),
      storageBucket: "creditform-d505d.firebasestorage.app",
    });
  }

  const db = getFirestore();
  const summary = {
    jobOffersDeleted: 0,
    jobOffersKeptGestionale: 0,
    jobApplicationsDeleted: 0,
    savedJobsDeleted: 0,
    storageCvDeleted: 0,
  };

  // 1) job_offers: elimina legacy (senza source gestionale)
  {
    const snap = await db.collection("job_offers").get();
    let batch = db.batch();
    let n = 0;
    for (const doc of snap.docs) {
      const source = String(doc.data()?.source || "").trim();
      if (source === "gestionale") {
        summary.jobOffersKeptGestionale += 1;
        continue;
      }
      batch.delete(doc.ref);
      n += 1;
      summary.jobOffersDeleted += 1;
      if (n >= 400) {
        await batch.commit();
        batch = db.batch();
        n = 0;
      }
    }
    if (n > 0) await batch.commit();
  }

  // 2) job_applications: tutte (ATS nativo)
  {
    const snap = await db.collection("job_applications").get();
    let batch = db.batch();
    let n = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      n += 1;
      summary.jobApplicationsDeleted += 1;
      if (n >= 400) {
        await batch.commit();
        batch = db.batch();
        n = 0;
      }
    }
    if (n > 0) await batch.commit();
  }

  // 3) users/{uid}/saved_jobs/*
  {
    const users = await db.collection("users").select().get();
    for (const userDoc of users.docs) {
      const saved = await userDoc.ref.collection("saved_jobs").get();
      if (saved.empty) continue;
      let batch = db.batch();
      let n = 0;
      for (const doc of saved.docs) {
        batch.delete(doc.ref);
        n += 1;
        summary.savedJobsDeleted += 1;
        if (n >= 400) {
          await batch.commit();
          batch = db.batch();
          n = 0;
        }
      }
      if (n > 0) await batch.commit();
    }
  }

  // 4) Storage cvs/ (CV candidature native CreditJob)
  try {
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: "cvs/" });
    for (const file of files) {
      await file.delete({ ignoreNotFound: true });
      summary.storageCvDeleted += 1;
    }
  } catch (e) {
    console.warn(
      "Storage cvs/ skip:",
      e instanceof Error ? e.message : String(e)
    );
  }

  console.log(
    JSON.stringify({ ok: true, project: "creditform-d505d", ...summary }, null, 2)
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
