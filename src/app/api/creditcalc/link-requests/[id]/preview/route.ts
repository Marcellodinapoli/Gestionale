import {
  creditCalcOptions,
  jsonErr,
  jsonOk,
} from "@/lib/creditcalc/cors";
import { requireCreditCalcFirebaseUser } from "@/lib/creditcalc/firebaseMobileAuth";
import {
  getLinkRequest,
  parseLinkRequestIdFromQr,
  refreshLinkRequestStatus,
} from "@/lib/creditcalc/store";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return creditCalcOptions(req);
}

/** Preview pairing (Firebase): azienda + operatore, senza secret. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  const { id: rawId } = await ctx.params;
  const id = parseLinkRequestIdFromQr(rawId) || rawId.trim();
  let link = await getLinkRequest(id);
  if (!link) return jsonErr("QR non valido", 404, req);
  link = await refreshLinkRequestStatus(link);

  if (link.status === "expired") return jsonErr("QR scaduto", 410, req);
  if (link.status === "consumed") return jsonErr("QR già utilizzato", 409, req);
  if (link.status === "revoked") return jsonErr("QR revocato", 410, req);
  if (link.status !== "pending") return jsonErr("QR non valido", 400, req);

  return jsonOk(
    {
      linkRequestId: link.linkRequestId,
      tenantName: link.tenantName,
      operatorName: link.operatorName,
      operatorEmail: link.operatorEmail,
      expiresAt: link.expiresAt,
      status: link.status,
    },
    req
  );
}
