/**
 * Aggiunge su Firestore una pratica di test (debitore + pratica) per tenant demo.
 * Uso: npx tsx scripts/add-pratica-test.ts
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

async function main() {
  const prisma = createFirebasePrisma();

  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (!tenant) throw new Error("Tenant demo non trovato. Esegui npm run db:seed");

  const mandante =
    (await prisma.mandante.findFirst({
      where: { tenantId: tenant.id, codice: "BNL01" },
    })) ||
    (await prisma.mandante.findFirst({ where: { tenantId: tenant.id } }));
  if (!mandante) throw new Error("Nessun mandante sul tenant demo");

  const supervisorTest = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "supervisor.test@gestionale.local",
      },
    },
  });
  const operatore = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "operatore@gestionale.local",
      },
    },
  });
  const assegnatarioId = supervisorTest?.id || operatore?.id || null;

  // Allinea gruppo del supervisor.test a quello di Sara (se presente)
  const sara = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "supervisor@gestionale.local",
      },
    },
  });
  if (supervisorTest && sara?.gruppoMandanti && !supervisorTest.gruppoMandanti) {
    await prisma.user.update({
      where: { id: supervisorTest.id },
      data: {
        gruppoNome: sara.gruppoNome || "Gruppo Test",
        gruppoMandanti: sara.gruppoMandanti,
      },
    });
  }

  const stamp = new Date();
  const numero = `PRC-TEST-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}-${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}`;

  const debitore = await prisma.debitore.create({
    data: {
      tenantId: tenant.id,
      nome: "Alessandro",
      cognome: "Test Cliente",
      codiceFiscale: "TSTLSS90A01H501X",
      telefono: "3339988776",
      email: "alessandro.test@email.it",
      indirizzo: "Via dei Test 42",
      citta: "Roma",
      cap: "00184",
      provincia: "RM",
      ndg: "TEST-9001",
    },
  });

  await prisma.debitoreRecapito.create({
    data: {
      debitoreId: debitore.id,
      tipo: "TELEFONO",
      valore: "3339988776",
      ordine: 1,
    },
  });

  const capitale = 1850;
  const interessi = 120;
  const spese = 45;
  const residuo = capitale + interessi + spese;

  const pratica = await prisma.pratica.create({
    data: {
      tenantId: tenant.id,
      numero,
      mandanteId: mandante.id,
      debitoreId: debitore.id,
      assegnatarioId,
      operatoreTitolareId: assegnatarioId,
      stato: "IN_LAVORAZIONE",
      esitoContatto: "NON_RISPONDE",
      tipoContatto: "TELEFONATA",
      capitale,
      interessi,
      spese,
      residuo,
      dataAffido: new Date(),
      numeroMandante: "112608",
      scadenza: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      memoAt: new Date(Date.now() + 1000 * 60 * 60 * 4),
      note: "Pratica di test creata su Firebase per verifica gestionale.",
    },
  });

  if (assegnatarioId) {
    await prisma.attivita.create({
      data: {
        praticaId: pratica.id,
        userId: assegnatarioId,
        tipo: "NOTA",
        dettaglio: "Pratica test inserita su Firestore (cliente Alessandro Test Cliente).",
      },
    });
  }

  console.log("OK Firebase");
  console.log({
    tenant: tenant.slug,
    pratica: pratica.numero,
    praticaId: pratica.id,
    debitore: `${debitore.cognome} ${debitore.nome}`,
    telefono: debitore.telefono,
    mandante: mandante.codice,
    assegnatario: supervisorTest?.email || operatore?.email || null,
    residuo,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
