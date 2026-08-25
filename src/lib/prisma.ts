import "server-only";
import type { PrismaClient } from "@prisma/client";
import { assertOperationalBackendReady } from "@/lib/dataAccess";
import { createFirebasePrisma } from "@/lib/firebase/firebasePrisma";

const globalForPrisma = globalThis as unknown as {
  firebasePrisma?: PrismaClient;
};

function getFirebaseClient(): PrismaClient {
  if (typeof window !== "undefined") {
    throw new Error("Firebase ops solo lato server");
  }
  assertOperationalBackendReady();
  if (globalForPrisma.firebasePrisma) return globalForPrisma.firebasePrisma;
  const client = createFirebasePrisma();
  globalForPrisma.firebasePrisma = client;
  return client;
}

/**
 * Client dati operativo: sempre Firestore.
 * `prisma` è solo il nome storico dell’API; non c’è SQLite/Postgres a runtime.
 * I tipi `@prisma/client` arrivano da `src/lib/firebase/schema.prisma`.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (prop === "$transaction" || prop === "$connect" || prop === "$disconnect") {
      return (...args: unknown[]) => {
        const client = getFirebaseClient();
        const value = Reflect.get(client, prop, receiver) as
          | ((...a: unknown[]) => unknown)
          | undefined;
        return typeof value === "function" ? value.apply(client, args) : value;
      };
    }
    return new Proxy(
      {},
      {
        get(_t, method) {
          return (...args: unknown[]) => {
            const client = getFirebaseClient();
            const delegate = Reflect.get(client, prop) as Record<string, unknown>;
            const fn = delegate?.[method as string];
            if (typeof fn !== "function") {
              throw new Error(`Firebase ops: ${String(prop)}.${String(method)} non disponibile`);
            }
            return fn.apply(delegate, args);
          };
        },
      }
    );
  },
});
