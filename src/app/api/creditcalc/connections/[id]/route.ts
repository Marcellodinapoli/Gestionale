import {
  creditCalcOptions,
  jsonErr,
  jsonOk,
} from "@/lib/creditcalc/cors";
import { requireCreditCalcFirebaseUser } from "@/lib/creditcalc/firebaseMobileAuth";
import { revokeConnection } from "@/lib/creditcalc/store";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return creditCalcOptions(req);
}

/** Scollega: revoca Connection (ownership verificata). */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireCreditCalcFirebaseUser(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, req);

  const { id } = await ctx.params;
  const result = await revokeConnection(auth.uid, id);
  if (!result.ok) return jsonErr(result.error, result.status, req);

  return jsonOk({ ok: true, connectionId: id, status: "revoked" }, req);
}
