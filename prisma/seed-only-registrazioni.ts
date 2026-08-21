import { PrismaClient } from "@prisma/client";
import { seedRegistrazioniDemo } from "./seedRegistrazioni";

const prisma = new PrismaClient();

seedRegistrazioniDemo(prisma)
  .then(() => {
    console.log("Registrazioni demo ok");
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
