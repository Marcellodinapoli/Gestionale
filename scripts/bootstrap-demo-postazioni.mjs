/**
 * Garantisce postazioni demo e account supervisor standard per i test.
 * Uso: node scripts/bootstrap-demo-postazioni.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Demo123!";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "demo" } });
  if (!tenant) {
    console.error("Tenant demo non trovato. Esegui prima il seed o crea il tenant.");
    process.exit(1);
  }

  let sede = await prisma.sede.findFirst({
    where: { tenantId: tenant.id, active: true },
    orderBy: { nome: "asc" },
  });
  if (!sede) {
    sede = await prisma.sede.create({
      data: { tenantId: tenant.id, nome: "Sede principale", active: true },
    });
    console.log("Creata sede:", sede.nome);
  }

  const daCreare = [
    { nome: "Postazione 1", interno: "201", email: "post1@gestionale.local", numeroFisso: "06 11112222" },
    { nome: "Postazione 2", interno: "202", email: "post2@gestionale.local", numeroFisso: "06 11113333" },
    { nome: "Postazione 3", interno: "203", email: "post3@gestionale.local", numeroFisso: null },
  ];

  for (const p of daCreare) {
    const exists = await prisma.postazione.findFirst({
      where: { tenantId: tenant.id, nome: p.nome },
    });
    if (exists) {
      if (!exists.sedeId) {
        await prisma.postazione.update({
          where: { id: exists.id },
          data: { sedeId: sede.id, active: true },
        });
      }
      continue;
    }
    await prisma.postazione.create({
      data: {
        tenantId: tenant.id,
        sedeId: sede.id,
        active: true,
        ...p,
      },
    });
    console.log("Creata postazione:", p.nome);
  }

  // Mantieni PC1 se esiste (non duplicare)
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const accounts = [
    {
      email: "supervisor@gestionale.local",
      name: "Sara Supervisor",
      role: "SUPERVISOR",
      acronimo: "SS",
    },
    {
      email: "supervisor.test@gestionale.local",
      name: "Supervisor Test (provvisorio)",
      role: "SUPERVISOR",
      acronimo: "SVT",
    },
    {
      email: "admin@gestionale.local",
      name: "Anna Admin",
      role: "ADMIN",
      acronimo: null,
    },
  ];

  for (const acc of accounts) {
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: acc.email } },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          active: true,
          role: acc.role,
          sedeId: sede.id,
          passwordHash,
          passwordChangedAt: new Date(),
          postazioneId: null,
        },
      });
      console.log("Aggiornato account:", acc.email);
    } else {
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: acc.email,
          name: acc.name,
          role: acc.role,
          acronimo: acc.acronimo,
          sedeId: sede.id,
          passwordHash,
          passwordChangedAt: new Date(),
          active: true,
        },
      });
      console.log("Creato account:", acc.email);
    }
  }

  const postazioni = await prisma.postazione.findMany({
    where: { tenantId: tenant.id, active: true },
    include: {
      sedeRef: { select: { nome: true } },
      occupanti: { where: { active: true }, select: { email: true } },
    },
    orderBy: { nome: "asc" },
  });

  console.log("\n=== Postazioni demo (libere = senza occupante) ===");
  for (const p of postazioni) {
    const occ = p.occupanti.map((o) => o.email).join(", ") || "libera";
    console.log(`  ${p.nome} (${p.interno || "—"}) · ${p.sedeRef?.nome} · ${occ}`);
  }

  console.log("\n=== Login supervisor ===");
  console.log("  Codice azienda: demo");
  console.log("  Email: supervisor@gestionale.local  oppure  supervisor.test@gestionale.local");
  console.log("  Password:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
