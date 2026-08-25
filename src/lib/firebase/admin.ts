import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { firebaseConfig } from "./config";

let initialized = false;

function loadServiceAccount(): Record<string, unknown> {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as Record<string, unknown>;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON non è un JSON valido.");
    }
  }

  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (filePath) {
    const absolute = resolve(process.cwd(), filePath);
    try {
      return JSON.parse(readFileSync(absolute, "utf8")) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Impossibile leggere il service account Firebase: ${absolute}`
      );
    }
  }

  throw new Error(
    "Credenziali Firebase Admin mancanti. Imposta FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH o GOOGLE_APPLICATION_CREDENTIALS."
  );
}

function ensureFirebaseAdmin() {
  if (initialized || getApps().length > 0) {
    initialized = true;
    return;
  }

  initializeApp({
    credential: cert(loadServiceAccount()),
    projectId: firebaseConfig.projectId,
  });
  initialized = true;
}

export function getFirebaseAuth() {
  ensureFirebaseAdmin();
  return getAuth();
}

export function getFirebaseFirestore() {
  ensureFirebaseAdmin();
  return getFirestore();
}

export { FieldValue };
