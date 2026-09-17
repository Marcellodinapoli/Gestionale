import "server-only";
import { prisma } from "@/lib/prisma";
import {
  toReceiverConfigRecord,
  validaReceiverBaseUrl,
  type RecruitingReceiverConfigRecord,
  type RecruitingReceiverConfigWriteInput,
} from "@/lib/recruiting/receiver";

function tenantIdOrThrow(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant mancante");
  return id;
}

export async function getReceiverConfig(
  tenantId: string
): Promise<RecruitingReceiverConfigRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const row = await prisma.recruitingReceiverConfig.findFirst({
    where: { tenantId: tid },
  });
  return row ? toReceiverConfigRecord(row) : null;
}

export async function upsertReceiverConfig(
  tenantId: string,
  input: RecruitingReceiverConfigWriteInput
): Promise<RecruitingReceiverConfigRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const current = await getReceiverConfig(tid);
  const data = {
    baseUrl: input.baseUrl,
    sourceName: input.sourceName || null,
    status: "ACTIVE" as const,
  };
  if (!current) {
    const created = await prisma.recruitingReceiverConfig.create({
      data: {
        tenantId: tid,
        ...data,
      },
    });
    return toReceiverConfigRecord(created);
  }
  const result = await prisma.recruitingReceiverConfig.updateMany({
    where: { id: current.id, tenantId: tid },
    data,
  });
  if (result.count !== 1) throw new Error("Configurazione non trovata");
  const updated = await getReceiverConfig(tid);
  if (!updated) throw new Error("Configurazione non trovata");
  return updated;
}

export async function deleteReceiverConfig(tenantId: string): Promise<void> {
  const tid = tenantIdOrThrow(tenantId);
  await prisma.recruitingReceiverConfig.deleteMany({
    where: { tenantId: tid },
  });
}

/** Probe HTTPS del ricevitore già salvato. Nessuna API Indeed. */
export async function probeReceiverConfig(
  tenantId: string
): Promise<RecruitingReceiverConfigRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const current = await getReceiverConfig(tid);
  if (!current) throw new Error("Ricevitore non configurato");
  const baseUrl = validaReceiverBaseUrl(current.baseUrl);
  const reachable = await probeHttpsReachable(baseUrl);
  const status = reachable ? "ACTIVE" : "ERROR";
  const result = await prisma.recruitingReceiverConfig.updateMany({
    where: { id: current.id, tenantId: tid },
    data: { status },
  });
  if (result.count !== 1) throw new Error("Configurazione non trovata");
  const updated = await getReceiverConfig(tid);
  if (!updated) throw new Error("Configurazione non trovata");
  return updated;
}

async function probeHttpsReachable(baseUrl: string): Promise<boolean> {
  const signal = AbortSignal.timeout(5000);
  const init: RequestInit = {
    redirect: "manual",
    cache: "no-store",
    signal,
  };
  try {
    const head = await fetch(baseUrl, { ...init, method: "HEAD" });
    await head.body?.cancel().catch(() => undefined);
    return head.status > 0;
  } catch {
    /* HEAD spesso non è esposto: prova GET senza leggere il body. */
  }
  try {
    const get = await fetch(baseUrl, { ...init, method: "GET" });
    await get.body?.cancel().catch(() => undefined);
    return get.status > 0;
  } catch {
    return false;
  }
}
