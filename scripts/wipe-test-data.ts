/**
 * Azzera mock/esempi di test su Firebase.
 * Conserva solo: tenant demo + utente admin@gestionale.local (password attuale).
 * Uso: npx tsx scripts/wipe-test-data.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFirebasePrisma } from "../src/lib/firebase/firebasePrisma";

function loadEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
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

loadEnv();
process.env.OPERATIONAL_BACKEND = "firebase";

const ADMIN_EMAIL = "admin@gestionale.local";

async function main() {
  const prisma = createFirebasePrisma();

  const tenants = await prisma.tenant.findMany();
  const demo =
    tenants.find((t) => t.slug === "demo") ||
    tenants[0] ||
    null;
  if (!demo) throw new Error("Nessun tenant trovato");

  const admin = await prisma.user.findFirst({
    where: {
      tenantId: demo.id,
      email: ADMIN_EMAIL,
    },
  });
  if (!admin) {
    throw new Error(`Admin ${ADMIN_EMAIL} non trovato sul tenant ${demo.slug}`);
  }

  const del = async (name: string, run: () => Promise<{ count?: number } | unknown>) => {
    try {
      const res = (await run()) as { count?: number };
      console.log(`ok ${name}`, res?.count ?? "");
    } catch (e) {
      console.warn(`skip ${name}`, e instanceof Error ? e.message : e);
    }
  };

  // Dati operativi / mock
  await del("auditLog", () => prisma.auditLog.deleteMany());
  await del("registrazioneChiamata", () => prisma.registrazioneChiamata.deleteMany());
  await del("messaggioInterno", () => prisma.messaggioInterno.deleteMany());
  await del("messaggioAgenda", () => prisma.messaggioAgenda.deleteMany());
  await del("impegnoAgenda", () => prisma.impegnoAgenda.deleteMany());
  await del("documento", () => prisma.documento.deleteMany());
  await del("pianoRata", () => prisma.pianoRata.deleteMany());
  await del("provvigione", () => prisma.provvigione.deleteMany());
  await del("incasso", () => prisma.incasso.deleteMany());
  await del("fattura", () => prisma.fattura.deleteMany());
  await del("attivita", () => prisma.attivita.deleteMany());
  await del("garanteRecapito", () => prisma.garanteRecapito.deleteMany());
  await del("garante", () => prisma.garante.deleteMany());
  await del("debitoreRecapito", () => prisma.debitoreRecapito.deleteMany());
  await del("praticaLock", () => prisma.praticaLock.deleteMany());
  await del("pratica", () => prisma.pratica.deleteMany());
  await del("debitore", () => prisma.debitore.deleteMany());
  await del("mandante", () => prisma.mandante.deleteMany());
  await del("configurazioneSistema", () => prisma.configurazioneSistema.deleteMany());
  await del("passwordHistory", () => prisma.passwordHistory.deleteMany());

  // Utenti non-admin (tutti i tenant)
  const users = await prisma.user.findMany();
  let usersRemoved = 0;
  for (const u of users) {
    if (u.id === admin.id) continue;
    await prisma.user.delete({ where: { id: u.id } });
    usersRemoved += 1;
  }
  console.log("ok users (non-admin)", usersRemoved);

  // Nessuna sede: l'admin configurerà tutto dal wizard /setup-sedi
  await del("postazione", () => prisma.postazione.deleteMany());
  await del("sede", () => prisma.sede.deleteMany());

  await prisma.user.update({
    where: { id: admin.id },
    data: { postazioneId: null, supervisorId: null, sedeId: null },
  });
  console.log("ok admin scollegato da sede/postazione");

  // Altri tenant (es. alfa)
  for (const t of tenants) {
    if (t.id === demo.id) continue;
    await prisma.tenant.delete({ where: { id: t.id } });
    console.log("ok tenant rimosso", t.slug);
  }

  console.log("");
  console.log("Pulizia completata. Rimasto:");
  console.log(`  tenant: ${demo.slug}`);
  console.log(`  admin:  ${ADMIN_EMAIL}`);
  console.log("  (password invariata; al login → setup sedi)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
