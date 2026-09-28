/**
 * URL pubblici per visualizzare un'offerta sulle piattaforme lavoro.
 *
 * CreditCore (sito pubblico Creditplanet):
 *   Base: NEXT_PUBLIC_CREDITCORE_PUBLIC_URL (default https://creditplanet.netlify.app)
 *   Forma: {base}/?job={firestoreDocId}  → landing con elenco offerte + focus
 *
 * Indeed: predisposto, non collegato finché manca NEXT_PUBLIC_INDEED_JOB_URL_TEMPLATE
 *   es. https://it.indeed.com/viewjob?jk={id}
 */

import { creditCoreOffertaDocId } from "@/lib/recruiting/creditCoreIds";

/** Landing pubblica CreditCore (elenco offerte). */
export const CREDITCORE_PUBLIC_URL_DEFAULT =
  "https://creditplanet.netlify.app";

export function creditCorePublicBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_CREDITCORE_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_CREDITCORE_APP_URL?.trim() ||
    CREDITCORE_PUBLIC_URL_DEFAULT;
  // Se qualcuno lascia ancora /app, torna alla root del sito pubblico.
  return raw
    .replace(/\/+$/, "")
    .replace(/\/app$/i, "");
}

/** Link all'offerta sulla landing CreditCore. */
export function creditCoreOffertaPublicUrl(
  tenantId: string,
  offertaId: string
): string {
  const docId = creditCoreOffertaDocId(tenantId, offertaId);
  const base = creditCorePublicBaseUrl();
  const origin = base.includes("://")
    ? base
    : `https://${base.replace(/^\/+/, "")}`;
  const u = new URL(origin.endsWith("/") ? origin : `${origin}/`);
  u.search = "";
  u.hash = "";
  u.searchParams.set("job", docId);
  return u.toString();
}

/**
 * Indeed — solo se configurato il template.
 * Placeholder `{id}` = indeedJobId Credixa (non è automaticamente il jk Indeed pubblico).
 */
export function indeedOffertaPublicUrl(
  indeedJobId: string | null | undefined
): string | null {
  const template = process.env.NEXT_PUBLIC_INDEED_JOB_URL_TEMPLATE?.trim();
  const jid = String(indeedJobId || "").trim();
  if (!template || !jid) return null;
  return template.split("{id}").join(encodeURIComponent(jid));
}

export function isIndeedPublicLinkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_INDEED_JOB_URL_TEMPLATE?.trim());
}
