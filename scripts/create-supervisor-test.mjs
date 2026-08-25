import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "supervisor.test@gestionale.local";
const PASSWORD = "Demo123!";

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "demo", active: true },
  });
  if (!tenant) throw new Error("Tenant demo non trovato");

  const sede =
    (await prisma.sede.findFirst({
      where: { tenantId: tenant.id, active: true },
      orderBy: { nome: "asc" },
    })) ??
    (await prisma.sede.create({
      data: { tenantId: tenant.id, nome: "Sede principale" },
    }));

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: EMAIL } },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: "Supervisor Test (provvisorio)",
          passwordHash,
          passwordChangedAt: new Date(),
          role: "SUPERVISOR",
          active: true,
          formazioneOnly: false,
          sedeId: sede.id,
          acronimo: "SVT",
        },
      })
    : await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: EMAIL,
          name: "Supervisor Test (provvisorio)",
          passwordHash,
          passwordChangedAt: new Date(),
          role: "SUPERVISOR",
          sedeId: sede.id,
          acronimo: "SVT",
          gruppoNome: "Gruppo Test",
        },
      });

  console.log("Supervisor provvisorio pronto:");
  console.log("  Codice azienda: demo");
  console.log("  Email:", EMAIL);
  console.log("  Password:", PASSWORD);
  console.log("  Nome:", user.name);
  console.log("  Sede:", sede.nome);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
