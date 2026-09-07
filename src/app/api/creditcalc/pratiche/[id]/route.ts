import {
  creditCalcOptions,
  jsonErr,
  jsonOk,
} from "@/lib/creditcalc/cors";
import { requireCreditCalcFirebaseUser } from "@/lib/creditcalc/firebaseMobileAuth";
import { requireOwnedActiveConnection } from "@/lib/creditcalc/store";
import { creditCalcTryAcquireLock } from "@/lib/creditcalc/praticaLock";
import { proxyCreditCalcPraticaDetail } from "@/lib/creditcalc/proxyPratiche";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return creditCalcOptions(req);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  const { id: praticaId } = await ctx.params;
  let body: { connectionId?: string; tenantId?: string; gestionaleUserId?: string } =
    {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const connectionId = String(body.connectionId || "").trim();
  if (!connectionId) return jsonErr("connectionId obbligatorio", 400, req);

  const owned = await requireOwnedActiveConnection(auth.uid, connectionId);
  if (!owned.ok) return jsonErr(owned.error, owned.status, req);

  try {
    const [data, lock] = await Promise.all([
      proxyCreditCalcPraticaDetail(owned.connection, praticaId),
      creditCalcTryAcquireLock(owned.connection, praticaId),
    ]);
    return jsonOk({ ...data, lock }, req);
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
