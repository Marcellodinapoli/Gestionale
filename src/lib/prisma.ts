import "server-only";
import { PrismaClient } from "@prisma/client";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { assertOperationalBackendReady } from "@/lib/dataAccess";
import { isSqliteProvider } from "@/lib/data/config";
import { createFirebasePrisma } from "@/lib/firebase/firebasePrisma";

/** Bump per forzare reload dello shim dopo HMR (evita client stale in globalThis). */
const FIREBASE_PRISMA_VERSION = 6;

const globalForPrisma = globalThis as unknown as {
  sqlitePrisma?: PrismaClient;
  firebasePrisma?: PrismaClientType;
  firebasePrismaVersion?: number;
};

function getSqliteClient(): PrismaClient {
  if (typeof window !== "undefined") {
    throw new Error("SQLite ops solo lato server");
  }
  assertOperationalBackendReady();
  if (!globalForPrisma.sqlitePrisma) {
    globalForPrisma.sqlitePrisma = new PrismaClient();
  }
  return globalForPrisma.sqlitePrisma;
}

function getFirebaseClient(): PrismaClientType {
  if (typeof window !== "undefined") {
    throw new Error("Firebase ops solo lato server");
  }
  assertOperationalBackendReady();
  if (
    globalForPrisma.firebasePrisma &&
    globalForPrisma.firebasePrismaVersion === FIREBASE_PRISMA_VERSION
  ) {
    return globalForPrisma.firebasePrisma;
  }
  const client = createFirebasePrisma();
  globalForPrisma.firebasePrisma = client;
  globalForPrisma.firebasePrismaVersion = FIREBASE_PRISMA_VERSION;
  return client;
}

function getClient(): PrismaClientType {
  return isSqliteProvider() ? getSqliteClient() : getFirebaseClient();
}

/**
 * Client dati operativo.
 * - sqlite: Prisma → file SQLite locale (solo dev)
 * - firestore: adapter Firebase
 */
export const prisma: PrismaClientType = new Proxy({} as PrismaClientType, {
  get(_target, prop, receiver) {
    if (prop === "$transaction" || prop === "$connect" || prop === "$disconnect") {
      return (...args: unknown[]) => {
        const client = getClient();
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
          if (
            method === "then" ||
            method === "catch" ||
            method === "finally" ||
            method === Symbol.toStringTag
          ) {
            return undefined;
          }
          return (...args: unknown[]) => {
            const client = getClient();
            const delegate = Reflect.get(client, prop) as Record<string, unknown>;
            const fn = delegate?.[method as string];
            if (typeof fn !== "function") {
              throw new Error(`Ops DB: ${String(prop)}.${String(method)} non disponibile`);
            }
            return fn.apply(delegate, args);
          };
        },
      }
    );
  },
});
