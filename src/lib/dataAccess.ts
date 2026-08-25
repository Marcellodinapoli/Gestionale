/**
 * Accesso dati Credixa — solo Firebase (Firestore).
 * Formazione: stesso progetto Firebase (creditform-d505d).
 */

export type OperationalBackend = "firebase" | "company";
export type FormazioneBackend = "firebase";

export function getOperationalBackend(): OperationalBackend {
  const raw = (process.env.OPERATIONAL_BACKEND || "firebase").trim().toLowerCase();
  if (raw === "company") return "company";
  return "firebase";
}

export function getFormazioneBackend(): FormazioneBackend {
  return "firebase";
}

export function assertOperationalBackendReady() {
  if (getOperationalBackend() === "company") {
    throw new Error(
      "Connettore database aziendale non ancora implementato. Usa Firebase (OPERATIONAL_BACKEND=firebase)."
    );
  }
}
