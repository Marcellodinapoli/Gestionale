import "server-only";
import { configurazioneDb } from "@/lib/configurazioneRepo";
import type { SessionUser } from "@/lib/permissions";
import { resolveTenantSlug } from "@/lib/praticheRepo";

export const OPERATORI_PROFILI_KEY = "operatori.profili";

export type OperatoreProfiloExtra = {
  /** Diploma, laurea, master, corsi, ecc. */
  qualificheScolastiche?: string | null;
};

export type OperatoriProfiliMap = Record<string, OperatoreProfiloExtra>;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readAll(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">
): Promise<OperatoriProfiliMap> {
  const row = await configurazioneDb({
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
  }).findUnique({
    where: {
      tenantId_chiave: { tenantId: user.tenantId, chiave: OPERATORI_PROFILI_KEY },
    },
    select: { valore: true },
  });
  return parseJson<OperatoriProfiliMap>(row?.valore, {});
}

async function writeAll(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  all: OperatoriProfiliMap
) {
  await configurazioneDb({
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
  }).upsert({
    where: {
      tenantId_chiave: { tenantId: user.tenantId, chiave: OPERATORI_PROFILI_KEY },
    },
    create: {
      tenantId: user.tenantId,
      chiave: OPERATORI_PROFILI_KEY,
      valore: JSON.stringify(all),
      categoria: "operatori",
    },
    update: { valore: JSON.stringify(all), categoria: "operatori" },
  });
}

export async function loadOperatoreProfiloExtra(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  userId: string
): Promise<OperatoreProfiloExtra> {
  const all = await readAll(user);
  return all[userId] || {};
}

export async function loadOperatoriProfiliAll(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">
): Promise<OperatoriProfiliMap> {
  return readAll(user);
}

export async function saveOperatoreProfiloExtra(
  user: Pick<SessionUser, "tenantId" | "tenantSlug">,
  userId: string,
  profilo: OperatoreProfiloExtra
) {
  const all = await readAll(user);
  const qualifiche = String(profilo.qualificheScolastiche || "").trim() || null;
  if (!qualifiche) {
    delete all[userId];
  } else {
    all[userId] = { qualificheScolastiche: qualifiche };
  }
  await writeAll(user, all);
}
