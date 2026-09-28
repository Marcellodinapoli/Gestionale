import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { classifyDurationMs } from "@/lib/performance/thresholds";
import type { PerfEventInput, PerfSessionTouch } from "@/lib/performance/types";

function newUuid(): string {
  return crypto.randomUUID();
}

/**
 * Crea o aggiorna una sessione performance.
 * SessionId deve essere univoco globalmente (UNIQUE).
 */
export async function upsertPerfSession(input: PerfSessionTouch): Promise<{
  sessionId: string;
  created: boolean;
}> {
  const sessionId = String(input.sessionId || "").trim() || newUuid();
  const existing = await neonQuery<{ Id: string; TenantId: string }>(
    `SELECT "Id", "TenantId" FROM "PerfSessions" WHERE "SessionId" = $1 LIMIT 1`,
    [sessionId]
  );

  if (existing[0]) {
    if (String(existing[0].TenantId) !== input.tenantId) {
      throw new Error("SessionId già usato da un altro tenant");
    }
    await neonQuery(
      `UPDATE "PerfSessions" SET
         "LastEventAt" = now(),
         "EndedAt" = CASE WHEN $2::boolean THEN now() ELSE "EndedAt" END,
         "UserId" = COALESCE($3, "UserId"),
         "UserRole" = COALESCE($4, "UserRole"),
         "UserAgent" = COALESCE($5, "UserAgent")
       WHERE "SessionId" = $1`,
      [
        sessionId,
        Boolean(input.ended),
        input.userId ?? null,
        input.userRole ?? null,
        input.userAgent ?? null,
      ]
    );
    return { sessionId, created: false };
  }

  await neonQuery(
    `INSERT INTO "PerfSessions" (
       "Id", "TenantId", "SessionId", "UserId", "UserRole",
       "StartedAt", "LastEventAt", "EndedAt", "UserAgent", "CreatedAt"
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5,
       now(), now(), CASE WHEN $6::boolean THEN now() ELSE NULL END, $7, now()
     )`,
    [
      newUuid(),
      input.tenantId,
      sessionId,
      input.userId ?? null,
      input.userRole ?? null,
      Boolean(input.ended),
      input.userAgent ?? null,
    ]
  );
  return { sessionId, created: true };
}

export async function insertPerfEvents(input: {
  tenantId: string;
  sessionId: string;
  events: PerfEventInput[];
}): Promise<number> {
  if (!input.events.length) return 0;

  // Assicura ownership sessione ↔ tenant
  const owned = await neonQuery<{ TenantId: string }>(
    `SELECT "TenantId" FROM "PerfSessions" WHERE "SessionId" = $1 LIMIT 1`,
    [input.sessionId]
  );
  if (!owned[0]) {
    await upsertPerfSession({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
    });
  } else if (String(owned[0].TenantId) !== input.tenantId) {
    throw new Error("Sessione performance non appartenente al tenant");
  }

  let inserted = 0;
  for (const e of input.events) {
    const durationClass = classifyDurationMs(e.durationMs);
    const meta =
      e.metadata && Object.keys(e.metadata).length
        ? JSON.stringify({
            ...e.metadata,
            ...(durationClass ? { durationClass } : {}),
          })
        : durationClass
          ? JSON.stringify({ durationClass })
          : null;

    await neonQuery(
      `INSERT INTO "PerfEvents" (
         "Id", "TenantId", "SessionId", "Timestamp", "Type",
         "Route", "Action", "Name", "DurationMs", "Status", "Metadata", "CreatedAt"
       ) VALUES (
         $1::uuid, $2::uuid, $3,
         COALESCE($4::timestamptz, now()),
         $5, $6, $7, $8, $9, $10,
         $11::jsonb, now()
       )`,
      [
        newUuid(),
        input.tenantId,
        input.sessionId,
        e.timestamp ?? null,
        e.type,
        e.route ?? null,
        e.action ?? null,
        e.name ?? null,
        e.durationMs ?? null,
        e.status ?? null,
        meta,
      ]
    );
    inserted += 1;
  }

  await neonQuery(
    `UPDATE "PerfSessions" SET "LastEventAt" = now() WHERE "SessionId" = $1 AND "TenantId" = $2::uuid`,
    [input.sessionId, input.tenantId]
  );

  return inserted;
}

/** Helper retention (da collegare a un job futuro). */
export async function deletePerfDataOlderThan(days: number): Promise<{
  events: number;
  sessions: number;
}> {
  const d = Math.max(1, Math.floor(days));
  const ev = await neonQuery<{ n: number }>(
    `WITH d AS (
       DELETE FROM "PerfEvents"
       WHERE "CreatedAt" < now() - ($1::int || ' days')::interval
       RETURNING 1
     ) SELECT COUNT(*)::int AS n FROM d`,
    [d]
  );
  const se = await neonQuery<{ n: number }>(
    `WITH d AS (
       DELETE FROM "PerfSessions"
       WHERE "CreatedAt" < now() - ($1::int || ' days')::interval
       RETURNING 1
     ) SELECT COUNT(*)::int AS n FROM d`,
    [d]
  );
  return { events: Number(ev[0]?.n || 0), sessions: Number(se[0]?.n || 0) };
}
