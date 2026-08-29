/**
 * Stampa FIREBASE_SERVICE_ACCOUNT_JSON su una riga per Netlify.
 * Uso: node scripts/netlify-firebase-env.mjs "C:\path\serviceAccount.json"
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const fileArg = process.argv[2]?.trim();
const fallback =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
  "C:\\Users\\Marcello\\Desktop\\creditform-d505d-3b3b46e977bc.json";
const filePath = resolve(fileArg || fallback);

if (!existsSync(filePath)) {
  console.error("File non trovato:", filePath);
  process.exit(1);
}

const json = JSON.parse(readFileSync(filePath, "utf8"));
const oneLine = JSON.stringify(json);

console.log("=== Copia TUTTA la riga sotto in Netlify → FIREBASE_SERVICE_ACCOUNT_JSON ===\n");
console.log(oneLine);
console.log("\n=== Fine (una sola riga, senza spazi a capo) ===");
