import {
  creditCalcOptions,
  jsonErr,
  jsonOk,
} from "@/lib/creditcalc/cors";
import { requireCreditCalcFirebaseUser } from "@/lib/creditcalc/firebaseMobileAuth";
import { requireOwnedActiveConnection } from "@/lib/creditcalc/store";
import {
  creditCalcReleaseLock,
  creditCalcRenewLock,
} from "@/lib/creditcalc/praticaLock";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return creditCalcOptions(req);
}

async function parseConnectionId(req: Request) {
  const url = new URL(req.url);
  const fromQuery = String(url.searchParams.get("connectionId") || "").trim();
  if (fromQuery) return fromQuery;

  let body: { connectionId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  return String(body.connectionId || "").trim();
}

/** Heartbeat lock (stesso TTL del gestionale). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  const { id: praticaId } = await ctx.params;
  const connectionId = await parseConnectionId(req);
  if (!connectionId) return jsonErr("connectionId obbligatorio", 400, req);

  const owned = await requireOwnedActiveConnection(auth.uid, connectionId);
  if (!owned.ok) return jsonErr(owned.error, owned.status, req);

  try {
    const lock = await creditCalcRenewLock(owned.connection, praticaId);
    return jsonOk(lock, req);
  } catch (e) {
    return jsonErr(
      e instanceof Error ? e.message : "Errore lock",
      502,
      req
    );
  }
}

/** Rilascia il lock quando l’operatore lascia la pratica sull’app. */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  const { id: praticaId } = await ctx.params;
  const connectionId = await parseConnectionId(req);
  if (!connectionId) return jsonErr("connectionId obbligatorio", 400, req);

  const owned = await requireOwnedActiveConnection(auth.uid, connectionId);
  if (!owned.ok) return jsonErr(owned.error, owned.status, req);

  try {
    await creditCalcReleaseLock(owned.connection, praticaId);
    return jsonOk({ ok: true }, req);
  } catch (e) {
    return jsonErr(
      e instanceof Error ? e.message : "Errore rilascio lock",
      502,
      req
    );
  }
}
