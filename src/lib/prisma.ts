import "server-only";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { assertOperationalBackendReady } from "@/lib/dataAccess";
import { createFirebasePrisma } from "@/lib/firebase/firebasePrisma";

/** Bump per forzare reload dello shim dopo HMR (evita client stale in globalThis). */
const FIREBASE_PRISMA_VERSION = 17;

const globalForPrisma = globalThis as unknown as {
  firebasePrisma?: PrismaClientType;
  firebasePrismaVersion?: number;
};

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

/**
 * Client dati legacy (Firestore) quando DATABASE_PROVIDER=firestore.
 * Con neon/connector i repo tipizzati non usano questo path.
 * SQLite locale non è più supportato.
 */
export const prisma: PrismaClientType = new Proxy({} as PrismaClientType, {
  get(_target, prop, receiver) {
    if (prop === "$transaction" || prop === "$connect" || prop === "$disconnect" || prop === "$queryRaw" || prop === "$executeRaw" || prop === "$executeRawUnsafe") {
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
          if (
            method === "then" ||
            method === "catch" ||
            method === "finally" ||
            method === Symbol.toStringTag
          ) {
            return undefined;
          }
          return (...args: unknown[]) => {
            const client = getFirebaseClient();
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
