import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { describeDataArchitecture } from "@/lib/dataAccess";
import {
  getActiveConnector,
  listUpdatedSince,
  readSyncCursor,
} from "@/lib/sync/incrementalSync";

/**
 * Stato sync + delta incrementale (solo dati modificati).
 * Le pagine leggono Firebase; questo endpoint alimenta soft-refresh client.
 */
export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const model = url.searchParams.get("model") || "Pratica";
  const sinceParam = url.searchParams.get("since");
  const since =
    sinceParam ||
    (await readSyncCursor(user.tenantId, model === "Pratica" ? "pratiche" : model));

  const connector = getActiveConnector();
  let delta: Array<Record<string, unknown>> = [];
  if (since) {
    delta = await listUpdatedSince({
      tenantId: user.tenantId,
      model,
      since,
      limit: 100,
    });
  }

  return NextResponse.json({
    architecture: describeDataArchitecture(),
    connector: connector.id,
    since,
    changed: delta.length,
    items: delta,
  });
}
