import {
  creditCalcOptions,
  jsonErr,
  jsonOk,
} from "@/lib/creditcalc/cors";
import { requireCreditCalcFirebaseUser } from "@/lib/creditcalc/firebaseMobileAuth";
import { requireOwnedActiveConnection } from "@/lib/creditcalc/store";
import { creditCalcAssertLockHeld } from "@/lib/creditcalc/praticaLock";
import { proxyCreditCalcLavorazione } from "@/lib/creditcalc/proxyPratiche";

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
  let body: {
    connectionId?: string;
    nota?: string | null;
    codiceScarico?: string | null;
    tenantId?: string;
    gestionaleUserId?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonErr("Body non valido", 400, req);
  }

  const connectionId = String(body.connectionId || "").trim();
  if (!connectionId) return jsonErr("connectionId obbligatorio", 400, req);

  const owned = await requireOwnedActiveConnection(auth.uid, connectionId);
  if (!owned.ok) return jsonErr(owned.error, owned.status, req);

  try {
    await creditCalcAssertLockHeld(owned.connection, praticaId);
    const data = await proxyCreditCalcLavorazione(owned.connection, praticaId, {
      nota: body.nota,
      codiceScarico: body.codiceScarico,
    });
    return jsonOk(data, req);
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
