import "server-only";
import { neonQuery } from "@/lib/neon/pool";

export type PerfSessionListItem = {
  sessionId: string;
  userId: string | null;
  userRole: string | null;
  startedAt: string | null;
  lastEventAt: string | null;
  endedAt: string | null;
  userAgent: string | null;
  eventCount: number;
};

export type PerfEventListItem = {
  id: string;
  timestamp: string | null;
  type: string;
  route: string | null;
  action: string | null;
  name: string | null;
  durationMs: number | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

function tsIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

export async function listPerfSessionsForTenant(
  tenantId: string,
  opts?: { take?: number }
): Promise<PerfSessionListItem[]> {
  const take = Math.min(200, Math.max(1, opts?.take ?? 50));
  const rows = await neonQuery<{
    SessionId: string;
    UserId: string | null;
    UserRole: string | null;
    StartedAt: Date | string | null;
    LastEventAt: Date | string | null;
    EndedAt: Date | string | null;
    UserAgent: string | null;
    EventCount: number;
  }>(
    `SELECT s."SessionId", s."UserId", s."UserRole", s."StartedAt", s."LastEventAt",
            s."EndedAt", s."UserAgent",
            (SELECT COUNT(*)::int FROM "PerfEvents" e
              WHERE e."TenantId" = s."TenantId" AND e."SessionId" = s."SessionId") AS "EventCount"
     FROM "PerfSessions" s
     WHERE s."TenantId" = $1::uuid
     ORDER BY COALESCE(s."LastEventAt", s."StartedAt") DESC
     LIMIT $2`,
    [tenantId, take]
  );

  return rows.map((r) => ({
    sessionId: String(r.SessionId),
    userId: r.UserId ? String(r.UserId) : null,
    userRole: r.UserRole ? String(r.UserRole) : null,
    startedAt: tsIso(r.StartedAt),
    lastEventAt: tsIso(r.LastEventAt),
    endedAt: tsIso(r.EndedAt),
    userAgent: r.UserAgent ? String(r.UserAgent) : null,
    eventCount: Number(r.EventCount || 0),
  }));
}

export async function listPerfEventsForSession(
  tenantId: string,
  sessionId: string,
  opts?: { take?: number }
): Promise<PerfEventListItem[]> {
  const take = Math.min(500, Math.max(1, opts?.take ?? 200));
  const rows = await neonQuery<{
    Id: string;
    Timestamp: Date | string | null;
    Type: string;
    Route: string | null;
    Action: string | null;
    Name: string | null;
    DurationMs: number | null;
    Status: string | null;
    Metadata: unknown;
  }>(
    `SELECT "Id", "Timestamp", "Type", "Route", "Action", "Name",
            "DurationMs", "Status", "Metadata"
     FROM "PerfEvents"
     WHERE "TenantId" = $1::uuid AND "SessionId" = $2
     ORDER BY "Timestamp" ASC
     LIMIT $3`,
    [tenantId, sessionId, take]
  );

  return rows.map((r) => {
    let metadata: Record<string, unknown> | null = null;
    if (r.Metadata && typeof r.Metadata === "object" && !Array.isArray(r.Metadata)) {
      metadata = r.Metadata as Record<string, unknown>;
    } else if (typeof r.Metadata === "string") {
      try {
        const p = JSON.parse(r.Metadata) as unknown;
        if (p && typeof p === "object" && !Array.isArray(p)) {
          metadata = p as Record<string, unknown>;
        }
      } catch {
        metadata = null;
      }
    }
    return {
      id: String(r.Id),
      timestamp: tsIso(r.Timestamp),
      type: String(r.Type),
      route: r.Route ? String(r.Route) : null,
      action: r.Action ? String(r.Action) : null,
      name: r.Name ? String(r.Name) : null,
      durationMs: r.DurationMs != null ? Number(r.DurationMs) : null,
      status: r.Status ? String(r.Status) : null,
      metadata,
    };
  });
}
