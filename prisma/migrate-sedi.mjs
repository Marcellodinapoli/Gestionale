/**
 * Migra Postazione.sede (testo) → Sede + Postazione.sedeId.
 * Crea "Sede principale" se manca.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureSede(tenantId, nome) {
  const existing = await prisma.sede.findUnique({
    where: { tenantId_nome: { tenantId, nome } },
  });
  if (existing) return existing;
  return prisma.sede.create({
    data: { tenantId, nome, active: true },
  });
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const t of tenants) {
    const principale = await ensureSede(t.id, "Sede principale");
    const postazioni = await prisma.postazione.findMany({
      where: { tenantId: t.id },
      select: { id: true, sedeLegacy: true, sedeId: true },
    });
    for (const p of postazioni) {
      if (p.sedeId) continue;
      const label = (p.sedeLegacy || "").trim() || "Sede principale";
      const sede = await ensureSede(t.id, label);
      await prisma.postazione.update({
        where: { id: p.id },
        data: { sedeId: sede.id },
      });
    }
    const users = await prisma.user.findMany({
      where: { tenantId: t.id, sedeId: null },
      select: {
        id: true,
        postazione: { select: { sedeId: true } },
      },
    });
    for (const u of users) {
      await prisma.user.update({
        where: { id: u.id },
        data: { sedeId: u.postazione?.sedeId || principale.id },
      });
    }
  }
  console.log("Migrazione sedi completata");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
