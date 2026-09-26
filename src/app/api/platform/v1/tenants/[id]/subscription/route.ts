import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import {
  isStatoPagamento,
  type UpdateAbbonamentoInput,
} from "@/lib/data/contracts/platformTenants";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const repo = getNeonPlatformTenantsRepository();
    const tenant = await repo.getById(id);
    if (!tenant) return platformError("Tenant non trovato", 404);
    return platformJson(tenant.abbonamento);
  } catch (e) {
    return platformError(e instanceof Error ? e.message : "Errore abbonamento", 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as UpdateAbbonamentoInput;
    if (
      body.statoPagamento != null &&
      !isStatoPagamento(String(body.statoPagamento))
    ) {
      return platformError(
        "statoPagamento deve essere NON_IMPOSTATO | IN_REGOLA | IN_RITARDO | SOSPESO",
        400
      );
    }
    const repo = getNeonPlatformTenantsRepository();
    const updated = await repo.updateAbbonamento(id, body);
    return platformJson(updated.abbonamento);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore aggiornamento abbonamento";
    return platformError(msg, /non trovato/i.test(msg) ? 404 : 400);
  }
}
