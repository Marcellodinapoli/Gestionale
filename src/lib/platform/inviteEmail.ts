import "server-only";

/**
 * Invio email invito ADMIN (Platform).
 * Provider: Resend via HTTP (nessuna dipendenza npm).
 * Env:
 *   CREDIXA_PUBLIC_URL — base pubblica (es. https://credixa-app.netlify.app)
 *   RESEND_API_KEY
 *   EMAIL_FROM — es. "Credixa <onboarding@tuodominio.it>"
 */

export function getCredixaPublicBaseUrl(): string {
  const raw = (
    process.env.CREDIXA_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    "https://credixa-app.netlify.app"
  ).trim();
  return raw.replace(/\/+$/, "");
}

export function buildActivationUrl(token: string): string {
  const t = String(token || "").trim();
  return `${getCredixaPublicBaseUrl()}/attiva-account?token=${encodeURIComponent(t)}`;
}

export type SendInviteEmailInput = {
  to: string;
  companyName: string;
  activationUrl: string;
  expiresAt: string;
};

export type SendInviteEmailResult =
  | { ok: true; provider: "resend"; id?: string }
  | { ok: false; reason: string };

function isEmailConfigured(): boolean {
  return Boolean(
    String(process.env.RESEND_API_KEY || "").trim() &&
      String(process.env.EMAIL_FROM || "").trim()
  );
}

export function inviteEmailConfigured(): boolean {
  return isEmailConfigured();
}

export async function sendAdminInviteEmail(
  input: SendInviteEmailInput
): Promise<SendInviteEmailResult> {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (!apiKey || !from) {
    return {
      ok: false,
      reason:
        "Email non configurata (impostare RESEND_API_KEY e EMAIL_FROM su Credixa)",
    };
  }

  const to = String(input.to || "").trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, reason: "Destinatario email non valido" };
  }

  const company = String(input.companyName || "la tua azienda").trim() || "la tua azienda";
  const expiresLabel = formatExpiry(input.expiresAt);
  const subject = `Attiva il tuo account Credixa — ${company}`;
  const text = [
    `Ciao,`,
    ``,
    `Sei stato invitato come amministratore di ${company} su Credixa.`,
    ``,
    `Apri questo link per impostare la password e attivare l'account:`,
    input.activationUrl,
    ``,
    expiresLabel ? `Il link scade il ${expiresLabel}.` : "",
    ``,
    `Se non hai richiesto tu questo invito, ignora questa email.`,
    ``,
    `— Credixa`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `
    <p>Ciao,</p>
    <p>Sei stato invitato come amministratore di <strong>${escapeHtml(company)}</strong> su Credixa.</p>
    <p><a href="${escapeHtml(input.activationUrl)}">Attiva il tuo account</a></p>
    <p style="word-break:break-all;font-size:12px;color:#555">${escapeHtml(input.activationUrl)}</p>
    ${
      expiresLabel
        ? `<p>Il link scade il <strong>${escapeHtml(expiresLabel)}</strong>.</p>`
        : ""
    }
    <p style="color:#777;font-size:12px">Se non hai richiesto tu questo invito, ignora questa email.</p>
    <p>— Credixa</p>
  `.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      const msg =
        body.message || body.name || `Resend HTTP ${res.status}`;
      return { ok: false, reason: String(msg) };
    }
    return { ok: true, provider: "resend", id: body.id };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Invio email fallito",
    };
  }
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("it-IT", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Rome",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
