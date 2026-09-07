import {
  creditCalcOptions,
  jsonErr,
  jsonOk,
} from "@/lib/creditcalc/cors";
import { requireCreditCalcFirebaseUser } from "@/lib/creditcalc/firebaseMobileAuth";
import { requireOwnedActiveConnection } from "@/lib/creditcalc/store";
import { proxyCreditCalcSession } from "@/lib/creditcalc/proxyPratiche";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return creditCalcOptions(req);
}

function connectionIdFrom(req: Request, body?: { connectionId?: string }) {
  const url = new URL(req.url);
  return (
    body?.connectionId?.trim() ||
    url.searchParams.get("connectionId")?.trim() ||
    ""
  );
}

/** Verifica Connection + profilo Connettore (server-side). */
export async function POST(req: Request) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  let body: { connectionId?: string; tenantId?: string; gestionaleUserId?: string } =
    {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  // J: ignora tenantId / gestionaleUserId dal client
  const connectionId = connectionIdFrom(req, body);
  if (!connectionId) return jsonErr("connectionId obbligatorio", 400, req);

  const owned = await requireOwnedActiveConnection(auth.uid, connectionId);
  if (!owned.ok) return jsonErr(owned.error, owned.status, req);

  try {
    const data = await proxyCreditCalcSession(owned.connection);
    return jsonOk(
      {
        connectionId: owned.connection.connectionId,
        tenantName: owned.connection.tenantName,
        operatorName: owned.connection.operatorName,
        profile: data.profile,
      },
      req
    );
  } catch (e) {
    const status =
      e && typeof e === "object" && "status" in e
        ? Number((e as { status: number }).status)
        : 502;
    return jsonErr(
      e instanceof Error ? e.message : "Errore connettore",
      status >= 400 && status < 600 ? status : 502,
      req
    );
  }
}
