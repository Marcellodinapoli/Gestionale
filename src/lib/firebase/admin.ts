import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firebaseConfig } from "./config";

let initialized = false;

function loadServiceAccount(): Record<string, unknown> {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    const candidates = [inline];
    if (inline.startsWith("'") && inline.endsWith("'")) {
      candidates.push(inline.slice(1, -1));
    }
    if (inline.startsWith('"') && inline.endsWith('"')) {
      candidates.push(inline.slice(1, -1));
    }
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as Record<string, unknown>;
      } catch {
        /* prova il candidato successivo */
      }
    }
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON non è un JSON valido.");
  }

  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (filePath) {
    const absolute = resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);
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
  // require lazy: evita di caricare firebase-admin su pagine pubbliche (login).
  const { cert, getApps, initializeApp } =
    require("firebase-admin/app") as typeof import("firebase-admin/app");

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
  const { getAuth } = require("firebase-admin/auth") as typeof import("firebase-admin/auth");
  return getAuth();
}

export function getFirebaseFirestore() {
  ensureFirebaseAdmin();
  const { getFirestore } =
    require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
  return getFirestore();
}

export function firebaseFieldValue() {
  ensureFirebaseAdmin();
  const { FieldValue } =
    require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
  return FieldValue;
}
