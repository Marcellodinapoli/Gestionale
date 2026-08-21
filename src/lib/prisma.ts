import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isClientReady(client: PrismaClient) {
  return "registrazioneChiamata" in client && "impegnoAgenda" in client;
}

function getClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && isClientReady(cached)) return cached;

  if (cached) {
    void cached.$disconnect();
  }

  const client = createClient();
  if (!isClientReady(client)) {
    throw new Error(
      "Client Prisma non aggiornato: esegui `npx prisma generate` e riavvia il server."
    );
  }

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
