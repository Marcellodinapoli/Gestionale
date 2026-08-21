import type { SoftphoneProtocol } from "@/lib/telephony/config";

export type DialHrefOptions = {
  protocol?: SoftphoneProtocol;
  sipDomain?: string;
};

function normalizeDigits(numero: string): string | null {
  const trimmed = numero.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  const n = digits.replace(/\D/g, "").length;
  if (n < 6) return null;
  return digits;
}

/** Antepone il prefisso centralino al numero (se non già presente). */
export function withPrefisso(numero: string, prefisso?: string | null): string {
  const digits = normalizeDigits(numero);
  if (!digits) return numero.trim();
  const pref = (prefisso || "").trim().replace(/[^\d+#*]/g, "");
  if (!pref) return digits;
  if (digits.startsWith(pref)) return digits;
  return `${pref}${digits}`;
}

/**
 * Click-to-call verso softphone / centralino.
 * CounterPath (Bria) tipicamente usa `callto:`; SIP usa `sip:numero@dominio`.
 */
export function buildDialHref(
  numero: string,
  opts: DialHrefOptions = {}
): string | null {
  const digits = normalizeDigits(numero);
  if (!digits) return null;

  const protocol = opts.protocol ?? "tel";
  const domain = (opts.sipDomain || "").trim();

  switch (protocol) {
    case "callto":
      return `callto:${digits}`;
    case "c2c":
      return `c2c:${digits}`;
    case "sip":
      return domain ? `sip:${digits}@${domain}` : `sip:${digits}`;
    case "tel":
    default:
      return `tel:${digits}`;
  }
}

/** @deprecated Preferire buildDialHref con protocollo tenant */
export function telHref(numero: string): string | null {
  return buildDialHref(numero, { protocol: "tel" });
}

export function chiamaNumero(numero: string, opts?: DialHrefOptions) {
  const href = buildDialHref(numero, opts ?? { protocol: "tel" });
  if (!href || typeof window === "undefined") return;
  window.location.href = href;
}

/** Apre il client di posta predefinito (Outlook se associato a `mailto:`). */
export function mailtoHref(email: string): string | null {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

export function apriMail(email: string) {
  const href = mailtoHref(email);
  if (!href || typeof window === "undefined") return;
  window.location.href = href;
}

/** Apre l'app SMS / gateway VoIP registrato sul protocollo `sms:`. */
export function smsHref(numero: string, testo?: string): string | null {
  const digits = normalizeDigits(numero);
  if (!digits) return null;
  if (!testo?.trim()) return `sms:${digits}`;
  return `sms:${digits}?body=${encodeURIComponent(testo.trim())}`;
}

export function apriSms(numero: string, testo?: string) {
  const href = smsHref(numero, testo);
  if (!href || typeof window === "undefined") return;
  window.location.href = href;
}
