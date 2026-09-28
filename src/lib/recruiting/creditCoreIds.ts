/** Id documento Firestore `job_offers` per sync gestionale → CreditCore. */
export function creditCoreOffertaDocId(tenantId: string, offertaId: string): string {
  const tid = String(tenantId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const oid = String(offertaId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `gestionale_${tid}_${oid}`;
}
