import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import {
  buildActivationUrl,
  sendAdminInviteEmail,
} from "@/lib/platform/inviteEmail";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Crea invito ADMIN monouso.
 * Restituisce `token` + `activationUrl` una sola volta.
 * Con `sendEmail: true` (default) tenta l'invio via Resend.
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as {
      email?: string;
      role?: string;
      expiresInHours?: number;
      createdByPlatformAdmin?: string;
      sendEmail?: boolean;
    };
    const repo = getNeonPlatformTenantsRepository();
    const invite = await repo.createInvite({
      tenantId: id,
      email: String(body.email || ""),
      role: body.role,
      expiresInHours:
        typeof body.expiresInHours === "number" ? body.expiresInHours : undefined,
      createdByPlatformAdmin: String(
        body.createdByPlatformAdmin || "platform-api"
      ),
    });

    const activationUrl = buildActivationUrl(invite.token);
    const wantEmail = body.sendEmail !== false;

    let emailSent = false;
    let emailError: string | undefined;

    if (wantEmail) {
      const tenant = await repo.getById(id);
      const companyName =
        (tenant?.ragioneSociale || "").trim() || "Credixa";
      const mail = await sendAdminInviteEmail({
        to: invite.email,
        companyName,
        activationUrl,
        expiresAt: invite.expiresAt,
      });
      if (mail.ok) {
        emailSent = true;
      } else {
        emailError = mail.reason;
      }
    }

    return platformJson(
      {
        ...invite,
        activationUrl,
        emailSent,
        ...(emailError ? { emailError } : {}),
      },
      201
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore creazione invito";
    return platformError(msg, /non trovato/i.test(msg) ? 404 : 400);
  }
}
