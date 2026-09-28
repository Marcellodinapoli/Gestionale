import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { isPerfMonitoringEnabled } from "@/lib/performance/enabled";
import { upsertPerfSession } from "@/lib/performance/repo";
import { clipUserAgent } from "@/lib/performance/ua";

/**
 * POST /api/performance/session
 * Crea/riutilizza sessione monitoring. TenantId sempre dal server.
 */
export async function POST(req: Request) {
  const userOrRes = await requireApiUser();
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  let enabled = false;
  try {
    enabled = await isPerfMonitoringEnabled(user.tenantId);
  } catch {
    enabled = false;
  }

  if (!enabled) {
    return NextResponse.json(
      { enabled: false, sessionId: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Ignora qualsiasi tenantId dal client.
  const clientSessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const sessionId =
    clientSessionId && /^[a-zA-Z0-9_-]{8,80}$/.test(clientSessionId)
      ? clientSessionId
      : crypto.randomUUID();

  const ended = body.ended === true;
  const userAgent = clipUserAgent(
    typeof body.userAgent === "string"
      ? body.userAgent
      : req.headers.get("user-agent")
  );

  try {
    const result = await upsertPerfSession({
      sessionId,
      tenantId: user.tenantId,
      userId: user.id,
      userRole: user.role,
      userAgent,
      ended,
    });
    return NextResponse.json(
      {
        enabled: true,
        sessionId: result.sessionId,
        created: result.created,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[perf] session upsert failed", err);
    return NextResponse.json(
      { enabled: true, error: "persist_failed", sessionId: null },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
