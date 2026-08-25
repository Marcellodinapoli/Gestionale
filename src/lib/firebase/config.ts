/** Progetto Firebase condiviso con CreditCalc Store / CreditForm. */
export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyDvg-vsDo-8sFzo6jVbeUWrRPEyFreO32I",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "creditform-d505d.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "creditform-d505d",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "creditform-d505d.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "418457726672",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:418457726672:web:4d0d18604a93fbdd93f8d5",
};

export const FIREBASE_FUNCTIONS_REGION = "europe-west1";
