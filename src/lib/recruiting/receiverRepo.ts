import "server-only";
import { prisma } from "@/lib/prisma";
import {
  toReceiverConfigRecord,
  validaReceiverBaseUrl,
  type RecruitingReceiverConfigRecord,
  type RecruitingReceiverConfigWriteInput,
} from "@/lib/recruiting/receiver";
import { propagateReceiverSourceName } from "@/lib/recruiting/candidatureRepo";
import {
  mapReceiverRow,
  newRecruitingId,
  recruitingPool,
  recruitingUsesSql,
  sql,
} from "@/lib/recruiting/sqlDb";

function tenantIdOrThrow(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant mancante");
  return id;
}

export async function getReceiverConfig(
  tenantId: string
): Promise<RecruitingReceiverConfigRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  if (!recruitingUsesSql()) {
    const row = await prisma.recruitingReceiverConfig.findFirst({
      where: { tenantId: tid },
    });
    return row ? toReceiverConfigRecord(row) : null;
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .query(`
      SELECT Id, TenantId, BaseUrl, Status, SourceName, CreatedAt, UpdatedAt
      FROM dbo.RecruitingReceiverConfig WHERE TenantId = @tenantId
    `);
  const row = res.recordset[0];
  return row ? toReceiverConfigRecord(mapReceiverRow(row)) : null;
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
  if (!recruitingUsesSql()) {
    if (!current) {
      await prisma.recruitingReceiverConfig.create({
        data: { tenantId: tid, ...data },
      });
    } else {
      const result = await prisma.recruitingReceiverConfig.updateMany({
        where: { id: current.id, tenantId: tid },
        data,
      });
      if (result.count !== 1) throw new Error("Configurazione non trovata");
    }
  } else {
    const pool = await recruitingPool();
    if (!current) {
      await pool
        .request()
        .input("id", sql.NVarChar(64), newRecruitingId())
        .input("tenantId", sql.NVarChar(64), tid)
        .input("baseUrl", sql.NVarChar(500), data.baseUrl)
        .input("sourceName", sql.NVarChar(80), data.sourceName)
        .input("status", sql.NVarChar(20), data.status)
        .query(`
          INSERT INTO dbo.RecruitingReceiverConfig (Id, TenantId, BaseUrl, Status, SourceName, CreatedAt, UpdatedAt)
          VALUES (@id, @tenantId, @baseUrl, @status, @sourceName, SYSUTCDATETIME(), SYSUTCDATETIME())
        `);
    } else {
      const result = await pool
        .request()
        .input("id", sql.NVarChar(64), current.id)
        .input("tenantId", sql.NVarChar(64), tid)
        .input("baseUrl", sql.NVarChar(500), data.baseUrl)
        .input("sourceName", sql.NVarChar(80), data.sourceName)
        .input("status", sql.NVarChar(20), data.status)
        .query(`
          UPDATE dbo.RecruitingReceiverConfig
          SET BaseUrl = @baseUrl, SourceName = @sourceName, Status = @status, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @id AND TenantId = @tenantId
        `);
      if (result.rowsAffected[0] !== 1) throw new Error("Configurazione non trovata");
    }
  }
  const updated = await getReceiverConfig(tid);
  if (!updated) throw new Error("Configurazione non trovata");
  const nextLabel = String(updated.sourceName || "").trim();
  if (nextLabel) {
    await propagateReceiverSourceName(tid, nextLabel);
  }
  return updated;
}

export async function deleteReceiverConfig(tenantId: string): Promise<void> {
  const tid = tenantIdOrThrow(tenantId);
  if (!recruitingUsesSql()) {
    await prisma.recruitingReceiverConfig.deleteMany({ where: { tenantId: tid } });
    return;
  }
  const pool = await recruitingPool();
  await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .query(`DELETE FROM dbo.RecruitingReceiverConfig WHERE TenantId = @tenantId`);
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
  if (!recruitingUsesSql()) {
    const result = await prisma.recruitingReceiverConfig.updateMany({
      where: { id: current.id, tenantId: tid },
      data: { status },
    });
    if (result.count !== 1) throw new Error("Configurazione non trovata");
  } else {
    const pool = await recruitingPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar(64), current.id)
      .input("tenantId", sql.NVarChar(64), tid)
      .input("status", sql.NVarChar(20), status)
      .query(`
        UPDATE dbo.RecruitingReceiverConfig
        SET Status = @status, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @id AND TenantId = @tenantId
      `);
    if (result.rowsAffected[0] !== 1) throw new Error("Configurazione non trovata");
  }
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
