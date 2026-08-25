import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seedRegistrazioniDemo } from "./seedRegistrazioni";
import { createFirebasePrisma } from "../src/lib/firebase/firebasePrisma";

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

loadEnvFile();
process.env.OPERATIONAL_BACKEND = "firebase";
const prisma = createFirebasePrisma();

seedRegistrazioniDemo(prisma)
  .then(() => {
    console.log("Registrazioni demo ok (Firestore)");
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
