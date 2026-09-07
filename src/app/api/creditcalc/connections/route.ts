import {
  creditCalcOptions,
  jsonErr,
  jsonOk,
} from "@/lib/creditcalc/cors";
import { requireCreditCalcFirebaseUser } from "@/lib/creditcalc/firebaseMobileAuth";
import {
  consumeLinkRequest,
  listConnectionsForCreditCalcUser,
  parseLinkRequestIdFromQr,
} from "@/lib/creditcalc/store";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return creditCalcOptions(req);
}

/** Elenco Connection attive per Firebase UID. */
export async function GET(req: Request) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  const items = await listConnectionsForCreditCalcUser(auth.uid);
  return jsonOk(
    {
      items: items.map((c) => ({
        connectionId: c.connectionId,
        tenantName: c.tenantName,
        operatorName: c.operatorName,
        operatorEmail: c.operatorEmail,
        status: c.status,
        createdAt: c.createdAt,
        // tenantId/gestionaleUserId NON esposti come campi modificabili;
        // connectionId è l'unico handle client.
      })),
    },
    req
  );
}

/** Conferma pairing: crea Connection permanente. Body: { linkRequestId } */
export async function POST(req: Request) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  let body: { linkRequestId?: string } = {};
  try {
    body = (await req.json()) as { linkRequestId?: string };
  } catch {
    return jsonErr("Body non valido", 400, req);
  }

  const raw = String(body.linkRequestId || "").trim();
  const linkRequestId = parseLinkRequestIdFromQr(raw) || raw;
  if (!linkRequestId) {
    return jsonErr("linkRequestId obbligatorio", 400, req);
  }

  // Ignora eventuali tenantId / gestionaleUserId nel body: solo dalla LinkRequest.
  const result = await consumeLinkRequest({
    linkRequestId,
    creditCalcUserId: auth.uid,
  });
  if (!result.ok) return jsonErr(result.error, result.status, req);

  const c = result.connection;
  return jsonOk(
    {
      connection: {
        connectionId: c.connectionId,
        tenantName: c.tenantName,
        operatorName: c.operatorName,
        operatorEmail: c.operatorEmail,
        status: c.status,
        createdAt: c.createdAt,
      },
    },
    req
  );
}
