import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { isPerfMonitoringEnabled } from "@/lib/performance/enabled";
import { insertPerfEvents } from "@/lib/performance/repo";
import { sanitizeEventBatch } from "@/lib/performance/sanitize";

/**
 * POST /api/performance/events
 * Ingest batch eventi. TenantId sempre dal server; client non può scegliere tenant.
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
      { enabled: false, inserted: 0 },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Ignora tenantId dal client.
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId || !/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const events = sanitizeEventBatch(body.events);
  if (!events.length) {
    return NextResponse.json(
      { enabled: true, inserted: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const inserted = await insertPerfEvents({
      tenantId: user.tenantId,
      sessionId,
      events,
    });
    return NextResponse.json(
      { enabled: true, inserted },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[perf] events insert failed", err);
    // Non far fallire l'app client: 200 soft-fail
    return NextResponse.json(
      { enabled: true, inserted: 0, error: "persist_failed" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
