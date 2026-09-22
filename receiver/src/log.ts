/** Log tecnico senza PII / CV / secret. */
export function logEvent(
  event: string,
  data: Record<string, unknown>
): void {
  const safe: Record<string, unknown> = { event };
  const allow = new Set([
    "eventId",
    "tenantId",
    "receiverCandidateId",
    "documentId",
    "endpoint",
    "status",
    "sizeBytes",
    "contentType",
    "outcome",
    "authMode",
    "indeedJobId",
  ]);
  for (const [k, v] of Object.entries(data)) {
    if (allow.has(k)) safe[k] = v;
  }
  console.info("[receiver]", JSON.stringify(safe));
}
