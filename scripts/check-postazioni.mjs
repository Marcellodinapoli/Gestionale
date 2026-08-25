import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      postazioneId: true,
      postazione: { select: { nome: true } },
    },
  });
  console.log("users postazione:", users);

  const postazioni = await prisma.postazione.findMany({
    where: { active: true },
    include: {
      sedeRef: { select: { nome: true } },
      occupanti: { where: { active: true }, select: { email: true, name: true } },
    },
  });
  console.log("postazioni:", JSON.stringify(postazioni, null, 2));
}

main().finally(() => prisma.$disconnect());
